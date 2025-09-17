import { Injectable } from '@angular/core';
import { LocalStorageBehaviorSubject } from '../misc/LocalStorageBehaviorSubject';

/**
 * Service that stores weather Curseforge support is enabled, synced with local storage.
 */
@Injectable()
export class CurseforgeSupportService {
  private curseforgeSupport$ = new LocalStorageBehaviorSubject<boolean>(
    'curseforge-support',
    false
  );
  support = this.curseforgeSupport$.asObservable();

  constructor() {}

  setCurseforgeSupport(curseforgeSupport: boolean) {
    this.curseforgeSupport$.next(curseforgeSupport);
  }
}
