import {Component, OnInit} from '@angular/core';
import {FilesService} from "./services/files.service";
import {VersionsService} from "./services/versions.service";
import {LoaderService} from "./services/loader.service";
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [FilesService, VersionsService, LoaderService]
})
export class AppComponent implements OnInit {
  title = 'Minecraft Mod Updater';

  constructor(private meta: Meta, private titleService: Title) {}

  ngOnInit() {
    this.titleService.setTitle(this.title);
    this.meta.addTags([
      {name: 'description', content: 'An easy-to-use config-free online Minecraft mod updater for Fabric and Forge'},
      {name: 'author', content: 'Simon Conrad'},
      {name: 'keywords', content: 'Minecraft Mod Updater Modrinth IsAvaible Easy Online Fabric Forge Quilt Simple'}
    ]);
  }

}
