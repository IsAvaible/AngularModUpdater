import { Component, OnDestroy, OnInit } from '@angular/core';
import { Loader, LoaderService } from '../../services/loader.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-loader-selector',
  templateUrl: './loader-selector.component.html',
  styleUrls: ['./loader-selector.component.css'],
  standalone: false
})
export class LoaderSelectorComponent implements OnInit, OnDestroy {
  loaderValues = Object.values(Loader);
  loader!: Loader;
  subscription!: Subscription;

  constructor(private loaderService: LoaderService) {}

  ngOnInit() {
    this.subscription = this.loaderService.loader.subscribe((loader) => {
      this.loader = loader;
    });
  }

  onSelect(loader: string) {
    this.loaderService.setLoader(loader as Loader);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
