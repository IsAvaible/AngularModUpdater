import {Component, EventEmitter, Output} from '@angular/core';

@Component({
  selector: 'app-start-button',
  templateUrl: './start-button.component.html',
  styleUrls: ['./start-button.component.css']
})
export class StartButtonComponent {
  @Output() notify = new EventEmitter();
}
