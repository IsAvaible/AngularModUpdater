import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {HttpClient} from "@angular/common/http";

@Injectable()
export class VersionsService {
  private versions$ = new BehaviorSubject<MinecraftVersion[]>([]);
  versions = this.versions$.asObservable();

  constructor(private http: HttpClient) {
    this.init();
  }

  public init() {
    this.http.get<{latest: {release: string, snapshot: string}, versions: [{id: string, type: string, url: string, time: string, releaseTime: string}]}>("https://launchermeta.mojang.com/mc/game/version_manifest.json").subscribe(data => {
      this.versions$.next(data.versions.filter(v => !v.id.includes('-') && v.id.startsWith('1.')).map(v => ({version: v.id, selected: v.id == data.latest.release})));
    });
  }

  setVersions(versions: MinecraftVersion[]) {
    this.versions$.next(versions);
  }
}


export interface MinecraftVersion {
  version: string;
  selected: boolean;
}
