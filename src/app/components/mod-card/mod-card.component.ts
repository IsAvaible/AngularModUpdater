import {Component, Input} from '@angular/core';
import {Project} from "../../libraries/modrinth/types.modrinth";
import {ExtendedVersion, VersionStatus} from "../mod-panel/mod-panel.component";

@Component({
  selector: 'app-mod-card',
  templateUrl: './mod-card.component.html',
  styleUrls: ['./mod-card.component.css']
})
export class ModCardComponent {
  @Input() versions!: ExtendedVersion[];
  @Input() project!: Project;
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
