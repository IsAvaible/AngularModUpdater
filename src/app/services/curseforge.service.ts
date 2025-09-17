import { Injectable } from '@angular/core';
import { Curseforge } from '../libraries/curseforge/curseforge';

/**
 * Service that acts a Wrapper around the Curseforge API.
 * (Adheres to the Singleton pattern)
 */
@Injectable({
  providedIn: 'root'
})
export class CurseforgeService extends Curseforge {
  constructor() {
    super();
  }
}
