import {Component, Input} from '@angular/core';
import {View} from "../mod-card.component";
import {ProjectType} from "../../../libraries/modrinth/types.modrinth";

@Component({
  selector: 'app-project-type-label',
  templateUrl: './project-type-label.component.html',
  styleUrls: ['./project-type-label.component.css']
})
export class ProjectTypeLabelComponent {
  @Input() type!: ProjectType;
  @Input() view!: View;

  ProjectType = ProjectType;
  protected readonly View = View;
}
