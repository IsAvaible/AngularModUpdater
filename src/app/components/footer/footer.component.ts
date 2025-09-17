import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
})
export class FooterComponent {
  mail: string = 'simon.felix.conrad@proton.me';
  github: string = 'https://github.com/IsAvaible/AngularModUpdater';
}
