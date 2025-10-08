import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-start-button',
  templateUrl: './start-button.component.html',
  styleUrls: ['./start-button.component.css'],
  standalone: false
})
export class StartButtonComponent {
  @Input() loading: boolean = false;
  @Output() notify = new EventEmitter();
}
