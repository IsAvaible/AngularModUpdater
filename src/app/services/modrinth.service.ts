import { Injectable } from '@angular/core';
import {Modrinth} from "../libraries/modrinth/modrinth";

@Injectable({
  providedIn: 'root'
})
export class ModrinthService extends Modrinth{
  constructor() { super() }
}
