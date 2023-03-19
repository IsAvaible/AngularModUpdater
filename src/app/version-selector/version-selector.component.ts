import {Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {trigger, style, animate, transition} from '@angular/animations';
import {Subscription} from "rxjs";
import {VersionsService, Version} from "../services/versions.service";

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
export class VersionSelectorComponent implements OnDestroy {
  versions!: Version[];
  showDropdown: boolean;
  subscription!: Subscription;

  constructor(private versionsService: VersionsService) {
    this.showDropdown = false;
  }

  ngOnInit() {
    this.subscription = this.versionsService.versions.subscribe(versions => {
      this.versions = versions;
    });
  }

  get version(): Version | undefined {
    return this.versions.find(v => v.selected)!;
  }

  onClick() {
    this.showDropdown = !this.showDropdown;
  }

  onSelect(version: Version) {
    if (!this.version) return;
    this.version.selected = false;
    version.selected = true;
    this.versionsService.setVersions(this.versions);
    this.showDropdown = false;
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

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}


