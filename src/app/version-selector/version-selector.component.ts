import {Component, ElementRef, HostListener, ViewChild} from '@angular/core';
import {trigger, style, animate, transition} from '@angular/animations';

@Component({
  selector: 'app-version-selector',
  templateUrl: './version-selector.component.html',
  styleUrls: ['./version-selector.component.css'],
  animations: [
    trigger('openClose', [
      transition(':enter', [style({opacity: 0, transform: 'scale(0.95)'}), animate('100ms ease-out', style({opacity: 1, transform: 'scale(1)'}))]),
      transition(':leave', [style({opacity: 1, transform: 'scale(1)'}), animate('75ms ease-in', style({opacity: 0, transform: 'scale(0.95)'}))])
    ])
  ]
})
export class VersionSelectorComponent {
  versions: Version[];
  showDropdown: boolean;

  constructor() {
    this.versions = ['1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19.0'].map((v, i) => ({version: v, selected: i === 0}));
    this.showDropdown = false;
  }

  get version(): Version {
    return this.versions.find(v => v.selected)!;
  }

  onClick() {
    this.showDropdown = !this.showDropdown;
  }

  onSelect(version: Version) {
    this.version.selected = false;
    version.selected = true;
  }

  @ViewChild('dropdown', { static: false }) dropdownRef: ElementRef | undefined;
  @ViewChild('button', { static: false }) buttonRef: ElementRef | undefined;
  @HostListener('document:mousedown', ['$event'])
  onGlobalClick(event: { target: any; }): void {
    if (this.showDropdown && (this.dropdownRef && !this.dropdownRef.nativeElement.contains(event.target)) && (this.buttonRef ? !this.buttonRef.nativeElement.contains(event.target) : false)) {
      // clicked outside => close dropdown list
      this.showDropdown = false;
    }
  }
}

interface Version {
  version: string;
  selected: boolean;
}


