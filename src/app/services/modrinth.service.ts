import { Injectable } from '@angular/core';
import {Modrinth} from "../libraries/modrinth/modrinth";

/**
 * Service that acts a Wrapper around the Modrinth API.
 * (Adheres to the Singleton pattern)
 */
@Injectable({
  providedIn: 'root'
})
export class ModrinthService extends Modrinth{
  constructor() { super() }
}
