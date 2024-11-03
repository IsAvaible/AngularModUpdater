import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {FilesService} from "../../services/files.service";
import {
  concatMap,
  delay,
  finalize,
  firstValueFrom,
  forkJoin,
  from, last,
  map,
  Observable,
  of,
  Subject,
  Subscription,
  take,
  tap
} from "rxjs";
import {MinecraftVersion, VersionsService} from "../../services/versions.service";
import {HttpClient} from "@angular/common/http";
import {Project, Version, AnnotatedError, Modpack} from "../../libraries/modrinth/types.modrinth";
import {View} from "../mod-card/mod-card.component";
import * as JSZip from "jszip";
import {saveAs} from 'file-saver';
import {Loader, LoaderService} from "../../services/loader.service";
import Swal from "sweetalert2";
import {ModrinthService} from "../../services/modrinth.service";

@Component({
  selector: 'app-mod-panel',
  templateUrl: './mod-panel.component.html',
  styleUrls: ['./mod-panel.component.css'],
})
export class ModPanelComponent implements OnInit, OnDestroy {
  availableMods: { versions: ExtendedVersion[], project: Project }[] = [];  // Stores all mods that are available for the selected mc version
  unavailableMods: { file: File, slug: string, project: Project }[] = [];  // Stores all mods that are not available for the selected mc version
  invalidLoaderMods: { file: File, slug: string, project: Project }[] = [];  // Stores all mods that are not available for the selected loader
  unresolvedMods: { file: File, slug: string | undefined, annotation: AnnotatedError | null }[] = [];  // Stores all mods that could not be resolved (network error, etc.)

  loading = false; // Whether the site is currently processing mods
  loadingPercent: number = 1; //

  order: any[] = ['versions[0].versionStatus', 'project.title'];  // Stores the order of the available mods list

  files: File[] = [];
  processedFilesNames: string[] = [];
  toProcess: File[] = [];
  mcVersions: MinecraftVersion[] = [];
  loader!: Loader;
  availableModsView: View = window.innerWidth < 1200 ? View.Grid : View.List;
  filesSubscription!: Subscription;
  versionsSubscription!: Subscription;
  loaderSubscription!: Subscription;
  private sha1 = require('js-sha1');
  private finishedSubscription!: Subscription;
  private percentSubscription!: Subscription;


  constructor() {
  }

  private filesService = inject(FilesService);
  private versionsService = inject(VersionsService);
  private loaderService = inject(LoaderService);
  private http = inject(HttpClient);
  private modrinth = inject(ModrinthService);

  /**
   * Resets all lists
   */
  resetLists() {
    this.availableMods = [];
    this.unavailableMods = [];
    this.invalidLoaderMods = [];
    this.unresolvedMods = [];
    this.processedFilesNames = [];
    this.toProcess = [];
  }

  ngOnInit() {
    // thy fates shall be intertwined
    this.filesSubscription = this.filesService.files.subscribe(files => {
      this.files = files;
    });
    this.versionsSubscription = this.versionsService.versions.subscribe(versions => {
      this.mcVersions = versions;
      this.resetLists();
    });
    this.loaderSubscription = this.loaderService.loader.subscribe(loader => {
      this.loader = loader;
      this.resetLists()
    })
  }

  ngOnDestroy() {
    // I’m choosing to live my life without limits (memory leaks that is)
    this.filesSubscription.unsubscribe();
    this.versionsSubscription.unsubscribe();
    this.loaderSubscription.unsubscribe();
  }

  /**
   * Handles request errors
   * @param file The file that caused the error
   */
  handleRequestError(file: File) {
    // Remove the file from the processed and toProcess lists, so that it can be reprocessed and won't be removed from the files list
    this.processedFilesNames.splice(this.processedFilesNames.indexOf(file.name), 1);
    this.toProcess.splice(this.toProcess.indexOf(file), 1);
  }

  /**
   * Removes files that have already been processed from the files list
   */
  filterProcessed() {
    const prevLen = this.files.length;
    // Remove already processed files. This is done to prevent duplicates
    this.files = this.files.filter(file => this.processedFilesNames.indexOf(file.name) == -1); // Remove already processed files
    // Remove files that will be reprocessed from the unresolved mods list
    this.unresolvedMods = this.unresolvedMods.filter(um => this.files.map(file => file.name).indexOf(um.file.name) == -1);
    // Propagate the changes to the files service
    this.filesService.setFiles(this.files);

    if (prevLen != this.files.length) { // If there were duplicates
      const skipped = prevLen - this.files.length;
      const message = `Skipping ${skipped} file` + (skipped > 1 ? "s that were" : " that was") + " already processed";
      console.log(message);
      Swal.fire({
        position: 'top-end',
        icon: 'warning',
        title: message,
        showConfirmButton: false,
        timer: 3000,
        backdrop: `rgba(0, 0, 0, 0.0)`
      })
    }
  }

  async processFile(file: File, mcVersion: MinecraftVersion): Promise<boolean> {
    const reader = new FileReader();

    const fileBuffer = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = () => reject(new Error(`Error reading file ${file.name}`));
      reader.readAsArrayBuffer(file);
    });

    if (!fileBuffer) {
      console.error(`Could not read ${file.name}`);
      this.unresolvedMods.push({
        file,
        slug: undefined,
        annotation: {error: {status: 0, message: "Could not read file"}}
      });
      return true;
    }

    const fileHash = this.sha1(fileBuffer);

    try {
      const versionData = await this.loadVersionData(fileHash, file);
      if (!versionData) return true; // Stop if error occurred during getVersion

      const projectData = await this.loadProjectData(versionData.project_id, file);
      if (!projectData) return true; // Stop if error occurred during getProject

      const versionsData = await this.loadVersionsData(
        projectData.id, mcVersion.version, this.getValidLoaders(), file
      );
      if (!versionsData) return true; // Stop if error occurred during getVersions

      this.addToAvailableMods(projectData, versionsData, versionData);
      return true;
    } catch (error: any) {
      console.error(`Error processing file ${file.name}:`, error);
      this.unresolvedMods.push({
        file,
        slug: undefined,
        annotation: {error: {status: 0, message: error.message || "Unknown error"}}
      });
      return true;
    }
  }

  // Helper function to load version data
  private async loadVersionData(fileHash: string, file: File) {
    const versionData = await firstValueFrom(this.modrinth.getVersionFromHash(fileHash));
    if (this.modrinth.isAnnotatedError(versionData)) {
      await this.handleAnnotatedError(versionData, file);
      return null;
    }
    return versionData;
  }

  // Helper function to load project data
  private async loadProjectData(projectId: string, file: File) {
    const projectData = await firstValueFrom(this.modrinth.getProject(projectId));
    if (this.modrinth.isAnnotatedError(projectData)) {
      await this.handleAnnotatedError(projectData, file, projectId);
      return null;
    }

    if (!this.isLoaderCompatible(projectData.loaders)) {
      this.invalidLoaderMods.push({file, slug: projectData.slug, project: projectData});
      return null;
    }
    return projectData;
  }

  // Helper function to load versions data
  private async loadVersionsData(
    projectId: string, version: string, validLoaders: string[], file: File
  ) {
    const targetVersionData = await firstValueFrom(
      this.modrinth.getVersionsFromId(projectId, version, validLoaders)
    );
    if (this.modrinth.isAnnotatedError(targetVersionData)) {
      await this.handleAnnotatedError(targetVersionData, file);
      return null;
    }
    return targetVersionData.length > 0 ? targetVersionData : null;
  }

  // Helper function to add project and versions data to availableMods
  private addToAvailableMods(projectData: Project, versionsData: Version[], versionData: Version) {
    const annotatedVersions = this.annotateVersionStatus(versionData, versionsData as ExtendedVersion[], versionData.id);
    if (!this.availableMods.some((mod) => mod.project.id === projectData.id)) {
      this.availableMods.push({versions: annotatedVersions, project: projectData});
    }
  }

  // Helper function to check loader compatibility
  private isLoaderCompatible(loaders: string[]): boolean {
    return (
      loaders.includes(this.loader.toLowerCase() as Loader) ||
      (this.loader === Loader.quilt && loaders.includes(Loader.fabric.toLowerCase() as Loader)) ||
      (this.loader === Loader.neoforge && loaders.includes(Loader.forge.toLowerCase() as Loader))
    );
  }

  // Helper function to get valid loaders based on selected loader
  private getValidLoaders(): Loader[] {
    const validLoaders = [this.loader];
    if (this.loader === Loader.quilt) validLoaders.push(Loader.fabric);
    else if (this.loader === Loader.neoforge) validLoaders.push(Loader.forge);
    return validLoaders;
  }

  // Helper function to annotate version statuses
  private annotateVersionStatus(
    installedVersion: any,
    targetVersions: ExtendedVersion[],
    targetedMcVersion: string
  ): ExtendedVersion[] {
    return targetVersions.map((version) => {
      version.selected = version === targetVersions[0]; // Mark first version as selected

      // Check if the uploaded mods minecraft version is lower than the selected version
      const uploadedMcVersion = installedVersion.dependencies['minecraft'] || installedVersion.game_versions[installedVersion.game_versions.length-1];
      if (uploadedMcVersion > targetedMcVersion || installedVersion.dependencies['minecraft']) {
        version.versionStatus = VersionStatus.Unspecified;
        return version;
      }

      if (version.id === installedVersion.id || version.id === installedVersion.versionId) {
        version.versionStatus = VersionStatus.Installed;
      } else if (version.date_published > installedVersion.date_published) {
        version.versionStatus = VersionStatus.Updated;
      } else {
        version.versionStatus = VersionStatus.Outdated;
      }
      return version;
    });
  }

  // Helper function to handle annotated errors
  private async handleAnnotatedError(errorData: any, file: File, slug?: string) {
    if (errorData.error.status === 410) {
      await Swal.fire({
        position: "top-end",
        icon: "error",
        title: "API Deprecated",
        text: "The Modrinth API has been deprecated. Please notify the maintainer on GitHub.",
        showConfirmButton: false,
        timer: 3000,
        backdrop: "rgba(0, 0, 0, 0.0)",
      });
    } else if (errorData.error.status !== 404) {
      this.handleRequestError(file);
    }
    if (errorData.error.status !== 0) {
      this.unresolvedMods.push({file, slug, annotation: errorData});
    }
  }


  /**
   * Runs the mod processing on the files uploaded by the user
   */
  updateMods(): [boolean, Observable<boolean>, Observable<number>] {
    this.filterProcessed();  // Remove already processed files
    let mcVersion: MinecraftVersion = this.mcVersions.find(v => v.selected)!;  // Get the selected version

    this.toProcess = [...new Set(this.files)]  // Remove duplicates (redundant)
    if (this.toProcess.length > 290) { // Limit the number of files to process to 295
      const message = `${this.toProcess.length - 290} file` + (this.toProcess.length - 290 > 1 ? "s" : "") + " will not be processed to prevent rate limiting";
      console.log(message);
      Swal.fire({
        position: 'top-end',
        icon: 'warning',
        title: message,
        showConfirmButton: false,
        timer: 3000,
        backdrop: `rgba(0, 0, 0, 0.0)`
      })
      this.toProcess.splice(289);
    }

    const anyToProcess = this.toProcess.length > 0;
    if (!anyToProcess) {
      return [anyToProcess, of(true), of(1)];
    }

    // Set chunk size
    const CHUNK_SIZE = 30;
    let processedCounter = 0;
    const percent$ = new Subject<number>();

    // Helper function to process a chunk of files
    const processChunk = (filesChunk: File[]): Observable<any> => {
      const chunkObservables = filesChunk.map(file =>
        from(this.processFile(file, mcVersion)).pipe(
          tap(() => processedCounter++),
          finalize(() => {
            console.log(processedCounter, this.toProcess.length);
            const percent = processedCounter / this.toProcess.length;
            percent$.next(percent);
            this.processedFilesNames.push(file.name);
          })
        )
      );
      return forkJoin(chunkObservables);  // Wait for all files in chunk to complete
    };

    // Create batches of files to process in chunks
    const chunkedObservables = Array.from({ length: Math.ceil(this.toProcess.length / CHUNK_SIZE) }, (_, i) =>
      processChunk(this.toProcess.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
    );

    const finalResult$ = from(chunkedObservables).pipe(
      concatMap(chunkObservable => chunkObservable),  // Process each chunk sequentially
      last(),  // Wait for the last chunk to complete
      map(() => true),
      tap(() => {
        percent$.next(1);  // 100% completion
        percent$.complete();
        // Remove processed files from the files list
        this.filesService.setFiles(this.files.filter(file => this.processedFilesNames.indexOf(file.name) === -1));
        this.toProcess = [];
      })
    );

    return [anyToProcess, finalResult$, percent$];
  }

  startUpdateMods() {
    const [anyToProcess, finished$, percent$] = this.updateMods();
    if (!anyToProcess) {
      return;
    }
    this.loadingPercent = 0;
    this.loading = true;
    if (this.finishedSubscription) this.finishedSubscription.unsubscribe();
    if (this.percentSubscription) this.percentSubscription.unsubscribe();
    this.finishedSubscription = finished$.pipe(delay(500)).subscribe(() => {
      this.loading = false;
    })
    this.percentSubscription = percent$.subscribe(percent => {
      this.loadingPercent = percent;
    })
  }

  /**
   * Downloads all mods in the availableMods list
   */
  downloadAll() {
    const files = this.availableMods.map(mod => mod.versions.find(version => version.selected)!.files.find(f => f.primary)!).flat();
    this.downloadMultiple(files);
  }

  /**
   * Download all updated mods in the availableMods list
   */
  downloadUpdated() {
    const updatedMods = this.availableMods.filter(mod =>
      mod.versions.some(version => version.selected && version.versionStatus == VersionStatus.Updated)
    );

    const files = updatedMods.map(mod =>
      mod.versions.find(version => version.selected && version.versionStatus == VersionStatus.Updated)!.files.find(f => f.primary)!
    );

    if (files.length == 0) {
      Swal.fire({
        position: 'top-end',
        icon: 'info',
        title: "No updated mods",
        showConfirmButton: false,
        timer: 2500,
        backdrop: `rgba(0, 0, 0, 0.0)`
      });
      return;
    }
    this.downloadMultiple(files);
  }

  /**
   * Downloads multiple files from a remote url
   * If there are more than 3 files, it will create a zip file with all the mods
   */
  async downloadMultiple(files: { filename: string, url: string }[]) {
    if (files.length <= 3) {
      for (let file of files) window.open(file.url);
    } else {
      const zip = new JSZip();
      let promises = [];
      for (let file of files) {
        if (file != undefined) {
          promises.push(fetch(file.url).then(r => zip.file(file.filename, r.blob())));
        }
      }
      await Promise.all(promises);
      zip.generateAsync({type: "blob"}).then((content) => {
        saveAs(content, "mods.zip");
      });
    }
  }

  /**
   * Opens the modrinth page of all mods in the availableMods list in a new tab
   */
  linkAll() {
    for (let version of this.availableMods) {
      window.open(`https://modrinth.com/mod/${version.project.slug}`)
    }
  }

  View = View;  // Expose the View enum to the template
}

export interface ExtendedVersion extends Version {
  versionStatus: VersionStatus;  // Whether the version is updated, installed or outdated
  selected: boolean;  // Whether the version was selected by the user
}

export enum VersionStatus {
  Updated,
  Installed,
  Outdated,
  Unspecified
}
