import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class LoaderService {
  private loader$ = new BehaviorSubject<Loader>(Loader.fabric);
  loader = this.loader$.asObservable();

  constructor() {}

  setLoader(loader: Loader) {
    this.loader$.next(loader);
  }
}


export enum Loader {
  fabric = 'Fabric',
  quilt = 'Quilt',
  forge = 'Forge'
}
