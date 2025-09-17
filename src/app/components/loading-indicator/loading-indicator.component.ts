import { Component, HostBinding, Input } from '@angular/core';
import { trigger, transition, animate, style } from '@angular/animations';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.component.html',
  styleUrls: ['./loading-indicator.component.css'],
  styles: [':host { display: block; overflow-y: clip }'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ height: '0', opacity: '0' }),
        animate('300ms ease-out', style({ height: '100%', opacity: '1' })),
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ height: '0', opacity: '0' })),
      ]),
    ]),
  ],
})
export class LoadingIndicatorComponent {
  @Input() percent: number = 0;
  @HostBinding('@slideInOut')
  protected readonly Math = Math;
}
