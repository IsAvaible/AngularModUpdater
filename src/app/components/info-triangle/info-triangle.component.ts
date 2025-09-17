import { Component, inject } from '@angular/core';
import { ModrinthService } from '../../services/modrinth.service';
import {
  animate,
  state,
  style,
  transition,
  trigger,
  AnimationEvent,
} from '@angular/animations';

@Component({
    selector: 'app-info-triangle',
    templateUrl: './info-triangle.component.html',
    styleUrls: ['./info-triangle.component.css'],
    animations: [
        trigger('openClose', [
            transition('open => closed', [animate('250ms ease-in')]),
            transition('closed => open', [animate('350ms ease-out')]),
            state('open', style({
                // The css of the triangle guarantees that the triangles sides have the same length (aspect-ratio: 1/1, width: auto, height: auto)
                // We can therefore set the min-width and min-height to the respective values that make sure the triangle fills the screen
                minWidth: '200vw',
                minHeight: '200vh',
            })),
            state('closed', style({})),
        ]),
    ],
    standalone: false
})
export class InfoTriangleComponent {
  showInfoSection = false;
  showInfoSectionTransition = false;

  modrinth = inject(ModrinthService);

  toggleInfoSection() {
    if (this.showInfoSection == this.showInfoSectionTransition) {
      // No unfinished animations
      this.showInfoSectionTransition = !this.showInfoSectionTransition;
    }
  }

  animationStart = ($event: AnimationEvent) => {
    if ($event.toState === 'open') {
      this.showInfoSection = true;
    }
  };

  animationDone($event: AnimationEvent) {
    if ($event.toState === 'closed') {
      this.showInfoSection = false;
    }
  }

  protected readonly Math = Math;
}
