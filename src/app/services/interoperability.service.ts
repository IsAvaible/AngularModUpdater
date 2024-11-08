import { Injectable } from '@angular/core';
import {Interoperability} from "../libraries/interop/interoperability";

/**
 * Service that acts a Wrapper around the Interoperability API.
 * (Adheres to the Singleton pattern)
 */
@Injectable({
  providedIn: 'root'
})
export class InteroperabilityService extends Interoperability {
  constructor() { super() }
}
