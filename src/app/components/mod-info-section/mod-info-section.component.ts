import { Component, Input } from '@angular/core';
import {
  UnavailableMod,
  UnresolvedMod
} from '../mod-panel/mod-panel.component';

@Component({
  selector: 'app-mod-info-section',
  templateUrl: './mod-info-section.component.html',
  styleUrls: ['./mod-info-section.component.css'],
  standalone: false
})
export class ModInfoSectionComponent {
  @Input() title = '';
  @Input() mods: (UnavailableMod | UnresolvedMod)[] = [];
  @Input() type: 'warning' | 'error' = 'warning';

  isUnresolvedMod(mod: UnavailableMod | UnresolvedMod): mod is UnresolvedMod {
    return 'slug' in mod;
  }
}
