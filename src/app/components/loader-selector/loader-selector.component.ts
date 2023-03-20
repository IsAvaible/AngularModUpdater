import {Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {animate, style, transition, trigger} from "@angular/animations";
import {Loader, LoaderService} from "../../services/loader.service";
import {Subscription} from "rxjs";

@Component({
  selector: 'app-loader-selector',
  templateUrl: './loader-selector.component.html',
  styleUrls: ['./loader-selector.component.css'],
  animations: [
    trigger('openClose', [
      transition(':enter', [style({opacity: 0, transform: 'scale(0.95)'}), animate('100ms ease-out', style({opacity: 1, transform: 'scale(1)'}))]),
      transition(':leave', [style({opacity: 1, transform: 'scale(1)'}), animate('75ms ease-in', style({opacity: 0, transform: 'scale(0.95)'}))])
    ])
  ]
})
export class LoaderSelectorComponent implements OnDestroy {
  loaderValues = Object.values(Loader);
  loader!: Loader;
  showDropdown: boolean;
  subscription!: Subscription;

  constructor(private loaderService: LoaderService) {
    this.showDropdown = false;
  }

  ngOnInit() {
    this.subscription = this.loaderService.loader.subscribe(loader => {
      this.loader = loader;
    });
  }

  onClick() {
    this.showDropdown = !this.showDropdown;
  }

  onSelect(loader: string) {
    this.loaderService.setLoader(loader as Loader);
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
