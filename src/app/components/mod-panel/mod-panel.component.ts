import {Component, OnDestroy, OnInit} from '@angular/core';
import {FilesService} from "../../services/files.service";
import {catchError, Subscription} from "rxjs";
import {MinecraftVersion, VersionsService} from "../../services/versions.service";
import {HttpClient} from "@angular/common/http";
import {Project, Version} from "../../libraries/modrinth/types.modrinth";
import {Modrinth} from "../../libraries/modrinth/modrinth";
import {View} from "../mod-card/mod-card.component";
import * as JSZip from "jszip";
import {saveAs} from 'file-saver';
import {Loader, LoaderService} from "../../services/loader.service";

@Component({
  selector: 'app-mod-panel',
  templateUrl: './mod-panel.component.html',
  styleUrls: ['./mod-panel.component.css'],
})
export class ModPanelComponent implements OnInit, OnDestroy {
  availableMods: {versions: Version[], project: Project, queryHash: string}[] = [];
  unavailableMods: { file: File, slug: string, project: Project }[] = [];
  invalidLoaderMods: { file: File, slug: string, project: Project }[] = [];
  unresolvedMods: { file: File, slug: string | undefined }[] = [];

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
  resetLists() {
    this.availableMods = []; this.unavailableMods = []; this.invalidLoaderMods = []; this.unresolvedMods = []; this.processedFilesNames = []; this.toProcess = [];
  }

  ngOnInit() {
    this.filesSubscription = this.filesService.files.subscribe(files => {
      this.files = files;
    });
    this.versionsSubscription = this.versionsService.versions.subscribe(versions => {
      this.mcVersions = versions;
      this.resetLists()
    });
    this.loaderSubscription = this.loaderService.loader.subscribe(loader => {
      this.loader = loader;
      this.resetLists()
    })
  }

  ngOnDestroy() {
    this.filesSubscription.unsubscribe();
    this.versionsSubscription.unsubscribe();
  }

  get loading() {
    const value = this.toProcess.length && (this.toProcess.length  + this.processedFilesNames.filter(name => this.toProcess.map(file => file.name).indexOf(name) == -1).length) != (this.availableMods.length + this.unavailableMods.length + this.invalidLoaderMods.length + this.unresolvedMods.length);
    if (!value && this.toProcess.length) {
      setTimeout(() => {
        this.filesService.setFiles([]);
        this.toProcess = [];
      }, 1)
    }
    return value;
  }

  async updateMods() {
    const headers = { };
    let mcVersion: MinecraftVersion = this.mcVersions.find(v => v.selected)!;
    this.toProcess = [...new Set(this.files.filter(file => this.processedFilesNames.indexOf(file.name) == -1))]
    for (const file of this.toProcess) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.processedFilesNames.push(file.name);
        if (e.target == null) {
          console.log("Error: Could not read " + file.name);
          this.unresolvedMods.push({file: file, slug: undefined});
          return;
        }
        // Generate the file hash
        const fileHash = this.sha1(e.target.result);
        // Request Modrinth API for the mod with the given hash
        this.http.get<Version>(`https://api.modrinth.com/v2/version_file/${fileHash}`, {headers: headers})
          .pipe(catchError(err => { // The mod is not available on Modrinth
            if (err.status == 404) {
              console.log(`Error: Mod ${file.name} is not available on Modrinth.`);
            }
            else {
              console.log(`Error: ${err.status} ${err.statusText} when trying to resolve ${file.name}`);
              if (err.headers["x-ratelimit-remaining"] == 0) {
                console.log(`Rate limit reached.`);
              }
            }
            this.unresolvedMods.push({file: file, slug: undefined});
            return [];
          }))
          .subscribe(versionData => {
          const slug = versionData.project_id;
          // Get project data
          this.ModrinthAPI.getProject(slug).subscribe(projectData => {
            if (projectData == null) {
              this.unresolvedMods.push({file: file, slug: slug});
            } else {
            const checkedLoader = (this.loader == Loader.quilt ? Loader.fabric : this.loader).toLowerCase() as Loader;
            if (!projectData.loaders.includes(checkedLoader)) { // Check if the mod is available for the selected loader (Fabric mods are also available for Quilt)
              this.invalidLoaderMods.push({file: file, slug: slug!, project: projectData});
              return;
            }
            // Get version data
            this.ModrinthAPI.getVersionFromSlug(slug, mcVersion.version, this.loader == Loader.forge ? [Loader.fabric] : [Loader.fabric, Loader.quilt]).subscribe(targetVersionData => {
              if (targetVersionData.length > 0) {
                this.availableMods.push({versions: targetVersionData, project: projectData, queryHash: fileHash});
              } else { // The mod is not available for the selected version
                this.unavailableMods.push({file: file, slug: slug!, project: projectData})
              }
            });
            }
          });
        });
      }
      reader.readAsArrayBuffer(file);
    }
  }

  downloadAll() {
    const files = this.availableMods.map(version => version.versions[0].files.find(f => f.primary)).flat();
    if (files.length <= 3) {
      for (let file of files) window.open(file!.url);
    } else {
      const zip = new JSZip();
      for (let file of files) {
        zip.file(file!.filename, file!.url);
      }
      zip.generateAsync({type:"blob"}).then((content) => {
        saveAs(content, "mods.zip");
      });
    }
  }

  linkAll() {
    for (let version of this.availableMods) {
      window.open(`https://modrinth.com/mod/${version.project.slug}`)
    }
  }

  View = View;
}
