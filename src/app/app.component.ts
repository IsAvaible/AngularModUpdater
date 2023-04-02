import { Component } from '@angular/core';
import {FilesService} from "./services/files.service";
import {VersionsService} from "./services/versions.service";
import {LoaderService} from "./services/loader.service";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [FilesService, VersionsService, LoaderService]
})
export class AppComponent {
  title = 'Minecraft Mod Updater';
}
