import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.css'],
  animations: [
    trigger('openClose', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('100ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        style({ opacity: 1, transform: 'scale(1)' }),
        animate('75ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ])
  ],
  standalone: false
})
export class DropdownComponent {
  @Input() label = '';
  @Input() items: any[] | null = [];
  @Input() selectedItem: any;
  @Output() selectionChange = new EventEmitter<any>();

  @ViewChild('dropdown', { static: false }) dropdownRef: ElementRef | undefined;
  @ViewChild('button', { static: false }) buttonRef: ElementRef | undefined;

  showDropdown = false;

  onClick() {
    this.showDropdown = !this.showDropdown;
  }

  onSelectItem(item: any) {
    this.selectionChange.emit(item);
    this.showDropdown = false;
  }

  @HostListener('document:mousedown', ['$event'])
  onGlobalClick(event: { target: any }): void {
    if (
      this.showDropdown &&
      this.dropdownRef &&
      !this.dropdownRef.nativeElement.contains(event.target) &&
      (this.buttonRef
        ? !this.buttonRef.nativeElement.contains(event.target)
        : false)
    ) {
      this.showDropdown = false;
    }
  }
}
