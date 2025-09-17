import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  VersionsService,
  MinecraftVersion
} from '../../services/versions.service';

@Component({
  selector: 'app-version-selector',
  templateUrl: './version-selector.component.html',
  styleUrls: ['./version-selector.component.css'],
  standalone: false
})
export class VersionSelectorComponent implements OnInit, OnDestroy {
  versions!: MinecraftVersion[]; // Stores all minecraft versions
  displayTypes = ['release']; // Configures, which version types are displayed in the version dialog
  filteredVersions!: string[]; // Stores all versions that match one of the display types
  subscription!: Subscription; // Subscription to unsubscribe from

  constructor(private versionsService: VersionsService) {}

  ngOnInit() {
    this.subscription = this.versionsService.versions.subscribe((versions) => {
      this.versions = versions;
      this.filteredVersions = this.versions
        .filter((v) => this.displayTypes.indexOf(v.type) != -1)
        .map((v) => v.version);
    });
  }

  get selectedVersion(): string | undefined {
    return this.versions.find((v) => v.selected)?.version;
  }

  onSelect(version: string) {
    const currentVersion = this.versions.find((v) => v.selected);
    if (currentVersion) {
      currentVersion.selected = false;
    }

    const newVersion = this.versions.find((v) => v.version === version);
    if (newVersion) {
      newVersion.selected = true;
    }

    this.versionsService.setVersions(this.versions);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
