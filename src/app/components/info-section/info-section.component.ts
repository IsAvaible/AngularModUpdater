import {Component, ElementRef, HostListener, inject, ViewChild} from '@angular/core';
import { Output, EventEmitter } from '@angular/core';
import {animate, style, transition, trigger} from "@angular/animations";
import {ModrinthService} from "../../services/modrinth.service";
import {CurseforgeSupportService} from "../../services/curseforgeSupport.service";

@Component({
  selector: 'app-info-section',
  templateUrl: './info-section.component.html',
  styleUrls: ['./info-section.component.css'],
  animations: [
    trigger('fadeInOutAnimation', [
      transition(':enter', [style({opacity: 0}), animate('300ms ease-out', style({opacity: 1}))]),
      transition(':leave', [style({opacity: 1}), animate('100ms ease-in', style({opacity: 0}))])
    ]),
    trigger('transformInOutAnimation', [
      transition(':enter', [style({transform: 'scale(0.75)'}), animate('200ms ease-out', style({transform: 'scale(1)'}))]),
      transition(':leave', [style({transform: 'scale(1)'}), animate('150ms ease-in', style({transform: 'scale(0.95)'}))])
    ])
  ]
})
export class InfoSectionComponent {
  modrinth = inject(ModrinthService);

  show = true;
  curseforgeSupport = false;

  curseforgeSupportService = inject(CurseforgeSupportService);
  constructor() {
    this.curseforgeSupportService.support.subscribe(support => {
      this.curseforgeSupport = support;
    });
  }

  @Output() closeEvent = new EventEmitter<boolean>(false);
  closeInfoSection() {
    this.show = false;
    this.closeEvent.next(true);
  }


  @ViewChild('modal', { static: false }) modalRef: ElementRef | undefined;
  @HostListener('document:mousedown', ['$event'])
  onGlobalClick(event: { target: any; }): void {
    if (this.modalRef && !this.modalRef.nativeElement.contains(event.target)) {
      // clicked outside => close info section
      this.closeInfoSection();
    }
  }

  toggleCurseforgeSupport($event: MouseEvent) {
    $event.preventDefault();
    $event.stopPropagation();
    this.curseforgeSupportService.setCurseforgeSupport(!this.curseforgeSupport);
  }

  protected readonly Math = Math;
}
