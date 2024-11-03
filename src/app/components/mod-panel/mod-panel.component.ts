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
import {Project, Version, AnnotatedError, Modpack, ProjectType} from "../../libraries/modrinth/types.modrinth";
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

  /**
   * Processes a file
   * @param file The file to process
   * @param mcVersion The selected minecraft version
   * @param hash The hash of the file
   */
  async processFile(file: File, mcVersion: MinecraftVersion, hash?: string): Promise<boolean> {
    const reader = new FileReader();
    let fileHash: string;

    if (hash == null) {
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

      fileHash = this.sha1(fileBuffer);
    } else {
      fileHash = hash;
    }

    try {
      const versionData = await this.loadVersionData(fileHash, file);
      if (!versionData) return true; // Stop if error occurred during getVersion

      const projectData = await this.loadProjectData(versionData.project_id, file);
      if (!projectData) return true; // Stop if error occurred during getProject

      const ignoreLoader = ![ProjectType.Mod, ProjectType.ModPack].includes(projectData.project_type);

      const versionsData = await this.loadVersionsData(
        projectData.id, mcVersion.version, ignoreLoader ? [] : this.getValidLoaders(), file
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

  /**
   * Loads version data from the modrinth API
   * @param fileHash The hash of the file
   * @param file The file to process
   * @private
   */
  private async loadVersionData(fileHash: string, file: File) {
    const versionData = await firstValueFrom(this.modrinth.getVersionFromHash(fileHash));
    if (this.modrinth.isAnnotatedError(versionData)) {
      await this.handleAnnotatedError(versionData, file);
      return null;
    }
    return versionData;
  }

  /**
   * Loads project data from the modrinth API
   * @param projectId The id of the project
   * @param file The file to process
   * @private
   */
  private async loadProjectData(projectId: string, file: File) {
    const projectData = await firstValueFrom(this.modrinth.getProject(projectId));
    if (this.modrinth.isAnnotatedError(projectData)) {
      await this.handleAnnotatedError(projectData, file, projectId);
      return null;
    }

    if ([ProjectType.Mod, ProjectType.ModPack].includes(projectData.project_type) && !this.isLoaderCompatible(projectData.loaders)) {
      this.invalidLoaderMods.push({file, slug: projectData.slug, project: projectData});
      return null;
    }
    return projectData;
  }

  /**
   * Loads versions data from the modrinth API
   * @param projectId The id of the project
   * @param version The version of the project
   * @param validLoaders The valid loaders for the project
   * @param file The file to process
   * @private
   */
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

  /**
   * Adds a project to the availableMods list
   * @param projectData The project data
   * @param versionsData The versions data
   * @param versionData The version data
   * @private
   */
  private addToAvailableMods(projectData: Project, versionsData: Version[], versionData: Version) {
    const annotatedVersions = this.annotateVersionStatus(versionData, versionsData as ExtendedVersion[], versionData.id);
    if (!this.availableMods.some((mod) => mod.project.id === projectData.id)) {
      this.availableMods.push({versions: annotatedVersions, project: projectData});
    }
  }

  /**
   * Checks if the selected loader is compatible with the project
   * @param loaders The loaders of the project
   * @private
   */
  private isLoaderCompatible(loaders: string[]): boolean {
    return (
      loaders.includes(this.loader.toLowerCase() as Loader) ||
      (this.loader === Loader.quilt && loaders.includes(Loader.fabric.toLowerCase() as Loader)) ||
      (this.loader === Loader.neoforge && loaders.includes(Loader.forge.toLowerCase() as Loader))
    );
  }

  /**
   * Returns the valid loaders for the selected loader
   * @private
   */
  private getValidLoaders(): Loader[] {
    const validLoaders = [this.loader];
    if (this.loader === Loader.quilt) validLoaders.push(Loader.fabric);
    else if (this.loader === Loader.neoforge) validLoaders.push(Loader.forge);
    return validLoaders;
  }

  /**
   * Annotates the versions with their status
   * @param installedVersion The installed version
   * @param targetVersions The target versions
   * @param targetedMcVersion The targeted minecraft version
   * @private
   */
  private annotateVersionStatus(
    installedVersion: any,
    targetVersions: ExtendedVersion[],
    targetedMcVersion: string
  ): ExtendedVersion[] {
    return targetVersions.map((version) => {
      version.selected = version === targetVersions[0]; // Mark first version as selected

      // Check if the uploaded mods minecraft version is lower than the selected version
      const uploadedMcVersion = installedVersion.dependencies['minecraft'] || installedVersion.game_versions[installedVersion.game_versions.length - 1];
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

  /**
   * Handles annotated errors
   * @param errorData The error data
   * @param file The file that caused the error
   * @param slug The slug of the project
   * @private
   */
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
   * @returns [anyToProcess, finished$, percent$] where anyToProcess is a boolean indicating if there are files to process,
   * finished$ is an observable that emits when the processing is finished, and percent$ is an observable that emits the progress percentage
   */
  /**
   * Runs the mod processing on the files uploaded by the user
   * @returns [anyToProcess, finished$, percent$] where anyToProcess is a boolean indicating if there are files to process,
   * finished$ is an observable that emits when the processing is finished, and percent$ is an observable that emits the progress percentage
   */
  async updateMods(): Promise<[boolean, Observable<boolean>, Observable<number>]> {
    this.filterProcessed();  // Remove already processed files
    let mcVersion: MinecraftVersion = this.mcVersions.find(v => v.selected)!;  // Get the selected version

    // Process JSON files first to extract modpack information
    const jsonFiles = this.files.filter(file => file.name.endsWith('.json'));
    const modHashes: Array<{hash: string, name: string, modpackFile: string}> = [];

    for (const jsonFile of jsonFiles) {
      try {
        const fileBuffer = await this.readFileAsArrayBuffer(jsonFile);
        if (!fileBuffer) {
          this.unresolvedMods.push({
            file: jsonFile,
            slug: undefined,
            annotation: {error: {status: 0, message: "Could not read modpack file"}}
          });
          continue;
        }

        const metadata = await this.modrinth.parseMrpack(fileBuffer, true);
        if (!metadata || this.modrinth.isAnnotatedError(metadata)) {
          this.unresolvedMods.push({
            file: jsonFile,
            slug: undefined,
            annotation: {error: {status: 0, message: "Could not parse modpack metadata"}}
          });
          continue;
        }

        const modpack = metadata as Modpack;
        modHashes.push(...modpack.files.map(mod => ({
          hash: mod.hashes['sha1'],
          name: mod.name || mod.path.split('/').pop() || 'Unknown mod',
          modpackFile: modpack.name ?? jsonFile.name
        })));
        this.processedFilesNames.push(jsonFile.name);
      } catch (error) {
        console.error(`Error processing JSON file ${jsonFile.name}:`, error);
        this.unresolvedMods.push({
          file: jsonFile,
          slug: undefined,
          annotation: {error: {status: 0, message: "Error processing modpack file"}}
        });
      }
    }

    // Filter out processed JSON files
    this.toProcess = [...new Set(this.files.filter(file => !file.name.endsWith('.json')))];

    const anyToProcess = this.toProcess.length > 0 || modHashes.length > 0;
    if (!anyToProcess) {
      return [anyToProcess, of(true), of(1)];
    }

    // Check file limit
    const totalProcessCount = this.toProcess.length + modHashes.length;
    if (totalProcessCount > 290) {
      const excluded = totalProcessCount - 290;
      const message = `${excluded} file${excluded > 1 ? 's' : ''} will not be processed to prevent rate limiting`;
      console.log(message);
      Swal.fire({
        position: 'top-end',
        icon: 'warning',
        title: message,
        showConfirmButton: false,
        timer: 3000,
        backdrop: `rgba(0, 0, 0, 0.0)`
      });
      // Trim both arrays to fit within limit
      const hashLimit = Math.min(modHashes.length, Math.floor(290 * (modHashes.length / totalProcessCount)));
      const fileLimit = 290 - hashLimit;
      modHashes.splice(hashLimit);
      this.toProcess.splice(fileLimit);
    }

    // Set chunk size and initialize counters
    const CHUNK_SIZE = 30;
    let processedCounter = 0;
    const totalToProcess = this.toProcess.length + modHashes.length;
    const percent$ = new Subject<number>();

    // Helper function to process a chunk of items (files or hashes)
    const processChunk = (items: Array<File | typeof modHashes[0]>): Observable<any> => {
      const chunkObservables = items.map(item => {
        if ('hash' in item) {
          // Process hash from modpack
          return from(this.processFile(new File([], `[${item.modpackFile}] ${item.name}`), mcVersion, item.hash)).pipe(
            tap(() => processedCounter++),
            finalize(() => {
              const percent = processedCounter / totalToProcess;
              percent$.next(percent);
            })
          );
        } else {
          // Process regular file
          return from(this.processFile(item, mcVersion)).pipe(
            tap(() => processedCounter++),
            finalize(() => {
              const percent = processedCounter / totalToProcess;
              percent$.next(percent);
              this.processedFilesNames.push(item.name);
            })
          );
        }
      });
      return forkJoin(chunkObservables);
    };

    // Combine files and hashes into a single array for processing
    const allItems = [...this.toProcess, ...modHashes];

    // Create batches of items to process in chunks
    const chunkedObservables = Array.from(
      { length: Math.ceil(allItems.length / CHUNK_SIZE) },
      (_, i) => processChunk(allItems.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
    );

    const finalResult$ = from(chunkedObservables).pipe(
      concatMap(chunkObservable => chunkObservable),
      last(),
      map(() => true),
      tap(() => {
        percent$.next(1);
        percent$.complete();
        this.filesService.setFiles(this.files.filter(file => this.processedFilesNames.indexOf(file.name) === -1));
        this.toProcess = [];
      })
    );

    return [anyToProcess, finalResult$, percent$];
  }

  /**
   * Helper method to read file as ArrayBuffer
   * @param file The file to read
   * @private
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = () => reject(new Error(`Error reading file ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  }

  async startUpdateMods() {
    const [anyToProcess, finished$, percent$] = await this.updateMods();
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
