import {Component, Input} from '@angular/core';
import {ModrinthProject} from "../../libraries/modrinth/types.modrinth";
import {ExtendedVersion, VersionStatus} from "../mod-panel/mod-panel.component";
import {animate, style, transition, trigger} from "@angular/animations";

@Component({
  selector: 'app-mod-card',
  templateUrl: './mod-card.component.html',
  styleUrls: ['./mod-card.component.css'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({height: 0}),
        animate('150ms ease-out', style({height: '*'}))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({height: 0, opacity: 0}))
      ])
    ])
  ]
})
export class ModCardComponent {
  @Input() versions!: ExtendedVersion[];
  @Input() project!: ModrinthProject;
  @Input() view!: View;

  showChangelog = false;

  get selectedVersion() : ExtendedVersion {
    return this.versions.find(v => v.selected)!;
  }

  set selectedVersion(version: ExtendedVersion) {
    this.versions.find(v => v.selected)!.selected = false;
    this.versions.find(v => v.id === version.id)!.selected = true;
  }

  get fileUrl() {
    return (this.selectedVersion.files.find(f => f.primary) || this.selectedVersion.files[0]).url;
  }

  toggleChangelog() {
    this.showChangelog = !this.showChangelog;
  }

  protected readonly View = View;
  protected readonly VersionStatus = VersionStatus;
}

export enum View {
  Grid,
  List
}
