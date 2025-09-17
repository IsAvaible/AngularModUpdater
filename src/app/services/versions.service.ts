import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { LocalStorageBehaviorSubject } from '../misc/LocalStorageBehaviorSubject';

/**
 * Service that stores all available minecraft versions and the selected version
 * Queries the Mojang API for the list of all versions
 */
@Injectable()
export class VersionsService {
  private versions$ = new BehaviorSubject<MinecraftVersion[]>([]);
  versions = this.versions$.asObservable();
  // Stores the selected version in local storage
  private selectedVersion$ = new LocalStorageBehaviorSubject<string | null>(
    'mc-version',
    null
  );

  constructor(private http: HttpClient) {
    this.init();
  }

  public init() {
    const defaultVersion = '1.20.1';
    // Initially populate the list only with the previously selected version / default version
    this.versions$.next([
      {
        version: this.selectedVersion$.value ?? defaultVersion,
        selected: true,
        type: 'release'
      },
      { version: 'Loading...', selected: false, type: 'release' }
    ]);
    // Get the list of all minecraft versions from Mojang
    this.http
      .get<{
        latest: { release: string; snapshot: string };
        versions: [
          {
            id: string;
            type: string;
            url: string;
            time: string;
            releaseTime: string;
          }
        ];
      }>('https://launchermeta.mojang.com/mc/game/version_manifest.json')
      .subscribe((data) => {
        // Filter all non-major versions and set the selected version
        this.versions$.next(
          data.versions.map((v) => ({
            version: v.id,
            selected:
              v.id == (this.selectedVersion$.value ?? data.latest.release),
            type: v.type
          }))
        );
      });
  }

  setVersions(versions: MinecraftVersion[]) {
    this.versions$.next(versions);
    this.selectedVersion$.next(
      versions.find((v) => v.selected)?.version ?? null
    );
  }
}

export interface MinecraftVersion {
  version: string;
  selected: boolean;
  type: string;
}
