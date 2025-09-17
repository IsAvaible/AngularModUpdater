import { Component, OnInit } from '@angular/core';
import { FilesService } from './services/files.service';
import { VersionsService } from './services/versions.service';
import { LoaderService } from './services/loader.service';
import { Meta, Title } from '@angular/platform-browser';
import { CurseforgeSupportService } from './services/curseforgeSupport.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [
    FilesService,
    VersionsService,
    LoaderService,
    CurseforgeSupportService,
  ],
})
export class AppComponent implements OnInit {
  title = 'Minecraft Mod Updater';

  constructor(
    private meta: Meta,
    private titleService: Title,
  ) {}

  ngOnInit() {
    this.titleService.setTitle(this.title);
    this.meta.addTags([]);
  }
}
