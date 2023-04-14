import {Component, inject} from '@angular/core';
import {ModrinthService} from "../../services/modrinth.service";
import {animate, style, transition, trigger} from "@angular/animations";

@Component({
  selector: 'app-info-triangle',
  templateUrl: './info-triangle.component.html',
  styleUrls: ['./info-triangle.component.css'],
})
export class InfoTriangleComponent {
  showInfoSection = false;

  ModrinthAPI = inject(ModrinthService);

  toggleInfoSection() {
    this.showInfoSection = !this.showInfoSection;
  }


}
