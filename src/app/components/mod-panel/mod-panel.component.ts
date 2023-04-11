import {Component, OnDestroy, OnInit} from '@angular/core';
import {FilesService} from "../../services/files.service";
import {Subscription} from "rxjs";
import {MinecraftVersion, VersionsService} from "../../services/versions.service";
import {HttpClient} from "@angular/common/http";
import {Project, Version, AnnotatedError} from "../../libraries/modrinth/types.modrinth";
import {Modrinth} from "../../libraries/modrinth/modrinth";
import {View} from "../mod-card/mod-card.component";
import * as JSZip from "jszip";
import {saveAs} from 'file-saver';
import {Loader, LoaderService} from "../../services/loader.service";
import Swal from "sweetalert2";

@Component({
  selector: 'app-mod-panel',
  templateUrl: './mod-panel.component.html',
  styleUrls: ['./mod-panel.component.css'],
})
export class ModPanelComponent implements OnInit, OnDestroy {
  availableMods: {versions: ExtendedVersion[], project: Project}[] = [];  // Stores all mods that are available for the selected mc version
  unavailableMods: { file: File, slug: string, project: Project }[] = [];  // Stores all mods that are not available for the selected mc version
  invalidLoaderMods: { file: File, slug: string, project: Project }[] = [];  // Stores all mods that are not available for the selected loader
  unresolvedMods: { file: File, slug: string | undefined, annotation: AnnotatedError | null }[] = [];  // Stores all mods that could not be resolved (network error, etc.)

  order: any[] = ['versions[0].currentlyInstalled', 'project.title'];  // Stores the order of the available mods list

  files: File[] = [];
  processedFilesNames: string[] = [];
  toProcess: File[] = [];
  mcVersions: MinecraftVersion[] = [];
  loader!: Loader;
  ModrinthAPI: Modrinth;
  availableModsView: View = window.innerWidth < 1200 ? View.Grid : View.List;
  filesSubscription!: Subscription;
  versionsSubscription!: Subscription;
  loaderSubscription!: Subscription;
  private sha1 = require('js-sha1');


  constructor(private filesService: FilesService, private versionsService: VersionsService, private loaderService: LoaderService, private http: HttpClient) {
    this.ModrinthAPI = new Modrinth(http);
  }

  /**
   * Resets all lists
   */
  resetLists() {
    this.availableMods = []; this.unavailableMods = []; this.invalidLoaderMods = []; this.unresolvedMods = []; this.processedFilesNames = []; this.toProcess = [];
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
   * Returns true if the component is currently processing files
   */
  get loading() {
    // Checks if there are files to process and if the size of the union of the processed files and the files to process is equal to the size of the files list
    const value = this.toProcess.length && (this.toProcess.length  + this.processedFilesNames.filter(name => this.toProcess.map(file => file.name).indexOf(name) == -1).length) != (this.availableMods.length + this.unavailableMods.length + this.invalidLoaderMods.length + this.unresolvedMods.length);
    if (!value && this.toProcess.length) { // If the component is no longer processing files and it was processing files before
      setTimeout(() => { // Push the processing to the next tick so that the files list can be updated
        this.filesService.setFiles(this.files.filter(file => this.processedFilesNames.indexOf(file.name) == -1)); // Remove all processed files from the files list
        this.toProcess = []; // Reset the toProcess list
      }, 1)
    }
    return value;
  }

  /**
   * Handles the error thrown when the rate limit is exceeded
   * @param file The file that caused the error
   */
  handleRateLimitError(file: File) {
    // Remove the file from the processed and toProcess lists, so that it can be reprocessed and won't be removed from the files list
    this.processedFilesNames.splice(this.processedFilesNames.indexOf(file.name), 1);
    this.toProcess.splice(this.toProcess.indexOf(file), 1);
  }

  /**
   * Removes files that have already been processed from the files list
   */
  filterProcessed() {
    const prevLen = this.files.length;
    // Remove already processed files. If the file is in the unresolved mods list and the error status is 404 keep it in the files list so that it can be reprocessed
    this.files = this.files.filter(file => this.processedFilesNames.indexOf(file.name) == -1 && (!this.unresolvedMods.find(um => um.file.name == file.name) || ((this.unresolvedMods.find(um => um.file.name == file.name)?.annotation?.error.status)??404 != 404))); // Remove already processed files
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
        backdrop: `rgba(0,0,0,0.0)`
      })
    }
  }

  /**
   * Runs the mod processing on the files uploaded by the user
   */
  updateMods() {
    this.filterProcessed();  // Remove already processed files
    let mcVersion: MinecraftVersion = this.mcVersions.find(v => v.selected)!;  // Get the selected version

    this.toProcess = [...new Set(this.files)]  // Remove duplicates (redundant)
    for (const file of this.toProcess) {
      const reader = new FileReader();  // Create a new FileReader for each file to allow parallel processing
      reader.onload = (e) => {
        this.processedFilesNames.push(file.name);
        if (e.target == null) {
          console.log("Error: Could not read " + file.name);
          this.unresolvedMods.push({file: file, slug: undefined, annotation: null});
          return;
        }
        // Generate the file hash
        const fileHash = this.sha1(e.target.result);
        // Request Modrinth API for the mod with the given hash
        this.ModrinthAPI.getVersionFromHash(fileHash)
          .subscribe(versionData => {
            if (this.ModrinthAPI.isAnnotatedError(versionData)) { // The mod is not on Modrinth
              if (versionData.error.status == 0) return this.handleRateLimitError(file);
              this.unresolvedMods.push({file: file, slug: undefined, annotation: versionData});
              return;
            }
            const slug = versionData.project_id;
            // Get project data
            this.ModrinthAPI.getProject(slug).subscribe(projectData => {
              if (this.ModrinthAPI.isAnnotatedError(projectData)) {
                if (projectData.error.status == 0) return this.handleRateLimitError(file);
                this.unresolvedMods.push({file: file, slug: slug, annotation: projectData});
                return;
              }
              const checkedLoader = (this.loader == Loader.quilt ? Loader.fabric : this.loader).toLowerCase() as Loader;
              if (!projectData.loaders.includes(checkedLoader)) { // Check if the mod is available for the selected loader (Fabric mods are also available for Quilt)
                this.invalidLoaderMods.push({file: file, slug: slug!, project: projectData});
                return;
              }
              // Get version data
              this.ModrinthAPI.getVersionFromSlug(slug, mcVersion.version, this.loader == Loader.forge ? [Loader.forge] : [Loader.fabric, Loader.quilt]).subscribe(targetVersionData => {
                if (this.ModrinthAPI.isAnnotatedError(targetVersionData)) {
                  if (targetVersionData.error.status == 0) return this.handleRateLimitError(file);
                  this.unresolvedMods.push({file: file, slug: slug, annotation: targetVersionData});
                  return
                }
                if (targetVersionData.length > 0) { // The mod has one or more versions available for the selected mc version
                  const extendedTargetVersionData = (targetVersionData  as ExtendedVersion[]).map(version => {version.currentlyInstalled = !!version.files.find(file => file.hashes.sha1 == fileHash); return version}); // Annotate whether the mod is already installed
                  extendedTargetVersionData[0].selected = true; // Select the first version by default
                  this.availableMods.push({versions: extendedTargetVersionData, project: projectData});
                } else { // The mod is not available for the selected mc version
                  this.unavailableMods.push({file: file, slug: slug!, project: projectData})
                }
              });
            });
        });
      }
      reader.readAsArrayBuffer(file);
    }
  }

  /**
   * Downloads all mods in the availableMods list
   * If there are more than 3 mods, it will create a zip file with all the mods
   */
  downloadAll() {
    const files = this.availableMods.map(mod => mod.versions.find(version => version.selected)!.files.find(f => f.primary)!).flat();
    if (files.length <= 3) {
      for (let file of files) window.open(file.url);
    } else {
      const zip = new JSZip();
      for (let file of files) {
        zip.file(file!.filename, file.url);
      }
      zip.generateAsync({type:"blob"}).then((content) => {
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

  View = View; // Expose the View enum to the template
}

export interface ExtendedVersion extends Version {
  currentlyInstalled: boolean;  // Whether the version is already installed
  selected: boolean;  // Whether the version was selected by the user
}
