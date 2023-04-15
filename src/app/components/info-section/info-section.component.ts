import { Component } from '@angular/core';
import { Output, EventEmitter } from '@angular/core';
import {animate, style, transition, trigger} from "@angular/animations";

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
  show = true;

  @Output() closeEvent = new EventEmitter<boolean>(false);
  closeInfoSection() {
    this.show = false;
    this.closeEvent.next(true);
  }
}
