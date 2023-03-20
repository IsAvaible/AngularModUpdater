import {Component, Input, OnInit} from '@angular/core';
import {Project, Version} from "../../libraries/modrinth/types.modrinth";

@Component({
  selector: 'app-mod-card',
  templateUrl: './mod-card.component.html',
  styleUrls: ['./mod-card.component.css']
})
export class ModCardComponent implements OnInit {
  @Input() versions!: Version[];
  @Input() project!: Project;
  @Input() queryHash!: string;
  @Input() view!: View;
  selectedVersion!: Version;
  ngOnInit() {
    this.selectedVersion = this.versions[0];
  }

  View = View;
  get isCurrent() {
    return this.selectedVersion.files.some(file => file.hashes.sha1 == this.queryHash);
  }
}

export enum View {
  Grid,
  List
}
