import { Component, Input } from '@angular/core';
import { View } from '../mod-card.component';
import { VersionStatus } from '../../mod-panel/mod-panel.component';

@Component({
  selector: 'app-mod-status-label',
  templateUrl: './mod-status-label.component.html',
  styleUrls: ['./mod-status-label.component.css'],
})
export class ModStatusLabelComponent {
  @Input() status!: VersionStatus;
  @Input() view!: View;

  VersionStatus = VersionStatus;
  protected readonly View = View;
}
