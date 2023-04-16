import { Injectable } from '@angular/core';
import {LocalStorageBehaviorSubject} from "../misc/LocalStorageBehaviorSubject";

/**
 * Service that stores the selected mod loader, synced with local storage
 */
@Injectable()
export class LoaderService {
  private loader$ = new LocalStorageBehaviorSubject<Loader>('mod-loader', Loader.fabric);
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
