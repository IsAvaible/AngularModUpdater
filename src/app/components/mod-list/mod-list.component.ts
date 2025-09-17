import { Component, Input } from '@angular/core';
import { Mod } from '../mod-panel/mod-panel.component';
import { View } from '../mod-card/mod-card.component';

@Component({
  selector: 'app-mod-list',
  templateUrl: './mod-list.component.html',
  styleUrls: ['./mod-list.component.css'],
  standalone: false
})
export class ModListComponent {
  @Input() mods: Mod[] = [];
  @Input() view: View = View.List;
  @Input() order: string[] = [];

  View = View;
}
