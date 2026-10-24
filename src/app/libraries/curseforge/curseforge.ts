import {
  CurseforgeFile,
  CurseforgeMod,
  CurseforgeResponse,
  SearchCriterias,
  SearchResult
} from './types.curseforge';
import { catchError, defer, map, Observable, of, timeout } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import compute_fingerprint from './fingerprint';
import { AnnotatedError, BaseApiProvider } from '../BaseApiProvider';
import { BatchQueue } from '../BatchQueue';

/**
 * Wrapper around the Curseforge API.
 *
 * @link https://docs.curseforge.com/rest-api/
 */
export class Curseforge extends BaseApiProvider {
  protected apiName = 'Curseforge';
  private static _instance: Curseforge;

  public curseforgeAPIUrl = 'https://api.curseforge.com/v1/';
  public headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-api-key': window.atob(
      'JDJhJDEwJEN0ZmFPQTRIT1phbXZTMXphVHUwLnVoTS51VzlNNzBQOGRyZnF2WUptOFNXdy5yWTlPSk1t'
    )
  };

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  private http = inject(HttpClient);

  public bufferDelay = 2000;

  private fileFingerprintQueue = new BatchQueue<number, CurseforgeFile>(
    (fingerprints) => this.getFilesFromFingerprints(fingerprints),
    () => this.bufferDelay
  );

  private modQueue = new BatchQueue<number, CurseforgeMod>(
    (ids) => this.getMods(ids),
    () => this.bufferDelay
  );

  private fileByIdQueue = new BatchQueue<number, CurseforgeFile>(
    (fileIds) => this.getFilesById(fileIds),
    () => this.bufferDelay
  );

  constructor() {
    super();
  }

  private parseMod(mod: CurseforgeMod): CurseforgeMod {
    mod.dateCreated = new Date(mod.dateCreated);
    mod.dateModified = new Date(mod.dateModified);
    mod.dateReleased = new Date(mod.dateReleased);
    return mod;
  }

  private parseFile(file: CurseforgeFile): CurseforgeFile {
    file.fileDate = new Date(file.fileDate);
    return file;
  }

  /**
   * Returns mods by their IDs
   * @param ids Array of mod IDs
   */
  public getMods(
    ids: number[]
  ): Observable<{ [id: number]: CurseforgeMod | AnnotatedError }> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return of({});
    }

    return defer(() =>
      this.http
        .post<CurseforgeResponse<CurseforgeMod[]>>(
          `${this.curseforgeAPIUrl}mods`,
          { modIds: uniqueIds },
          { headers: this.headers, observe: 'response' }
        )
        .pipe(timeout(15000))
    ).pipe(
      this.createRetryStrategy(3, 1000),
      map((resp) => {
        this.trackRateLimit(resp.headers);
        const result: { [id: number]: CurseforgeMod | AnnotatedError } = {};
        (resp.body?.data ?? []).forEach((mod) => {
          result[mod.id] = this.parseMod(mod);
        });
        uniqueIds.forEach((id) => {
          if (result[id] === undefined) {
            result[id] = {
              error: { message: 'Mod not found', status: 404 }
            };
          }
        });
        return result;
      }),
      catchError(
        this.createBatchErrorHandler<number, CurseforgeMod>(
          uniqueIds,
          'Error fetching mods'
        )
      )
    );
  }

  /**
   * Returns a single mod by ID
   * @param id Mod ID
   */
  public getMod(id: number): Observable<CurseforgeMod | AnnotatedError> {
    return this.modQueue.enqueue(id);
  }

  /**
   * Returns files by their fingerprints
   * @param fingerprints Array of file fingerprints
   */
  private getFilesFromFingerprints(
    fingerprints: number[]
  ): Observable<{ [fingerprint: number]: CurseforgeFile | AnnotatedError }> {
    const uniqueFingerprints = [...new Set(fingerprints)];
    if (uniqueFingerprints.length === 0) {
      return of({});
    }

    return defer(() =>
      this.http
        .post<
          CurseforgeResponse<{
            exactMatches: { file: CurseforgeFile; id: number }[];
          }>
        >(
          `${this.curseforgeAPIUrl}fingerprints`,
          { fingerprints: uniqueFingerprints },
          { headers: this.headers, observe: 'response' }
        )
        .pipe(timeout(15000))
    ).pipe(
      this.createRetryStrategy(3, 1000),
      map((resp) => {
        this.trackRateLimit(resp.headers);
        const result: {
          [fingerprint: number]: CurseforgeFile | AnnotatedError;
        } = {};
        const matches = resp.body?.data?.exactMatches ?? [];
        uniqueFingerprints.forEach((fingerprint) => {
          const res = matches.find(
            (item) => item.file.fileFingerprint === fingerprint
          );
          if (res) {
            result[fingerprint] = this.parseFile(res.file);
          } else {
            result[fingerprint] = {
              error: { message: 'Not found', status: 404 }
            };
          }
        });
        return result;
      }),
      catchError(
        this.createBatchErrorHandler<number, CurseforgeFile>(
          uniqueFingerprints,
          'Error fetching fingerprints'
        )
      )
    );
  }

  /**
   * Returns files by their IDs
   * @param fileIds Array of file IDs
   */
  private getFilesById(
    fileIds: number[]
  ): Observable<{ [fileId: number]: CurseforgeFile | AnnotatedError }> {
    const uniqueFileIds = [...new Set(fileIds)];
    if (uniqueFileIds.length === 0) {
      return of({});
    }

    return defer(() =>
      this.http
        .post<CurseforgeResponse<CurseforgeFile[]>>(
          `${this.curseforgeAPIUrl}mods/files`,
          { fileIds: uniqueFileIds },
          { headers: this.headers, observe: 'response' }
        )
        .pipe(timeout(15000))
    ).pipe(
      this.createRetryStrategy(3, 1000),
      map((resp) => {
        this.trackRateLimit(resp.headers);
        const result: { [fileId: number]: CurseforgeFile | AnnotatedError } =
          {};
        (resp.body?.data ?? []).forEach((file) => {
          result[file.id] = this.parseFile(file);
        });
        uniqueFileIds.forEach((fileId) => {
          if (result[fileId] === undefined) {
            result[fileId] = {
              error: { message: 'File not found', status: 404 }
            };
          }
        });
        return result;
      }),
      catchError(
        this.createBatchErrorHandler<number, CurseforgeFile>(
          uniqueFileIds,
          'Error fetching files by ID'
        )
      )
    );
  }

  /**
   * Finds a matching file for the given buffer
   * @param buffer The binary representation of the mod file
   */
  public getFileFromBuffer(
    buffer: ArrayBuffer
  ): Observable<CurseforgeFile | AnnotatedError> {
    const fingerprint = compute_fingerprint(new Uint8Array(buffer));
    return this.fileFingerprintQueue.enqueue(fingerprint);
  }

  /**
   * Returns a single file by ID
   * @param fileId File ID
   */
  public getFileFromIndex(
    fileId: number
  ): Observable<CurseforgeFile | AnnotatedError> {
    return this.fileByIdQueue.enqueue(fileId);
  }

  /**
   * Searches for mods with the given search criteria
   * @param searchCriterias The search criteria
   */
  public searchMods(
    searchCriterias: SearchCriterias
  ): Observable<SearchResult | AnnotatedError> {
    let url = this.curseforgeAPIUrl + 'mods/search?gameId=432';

    Object.entries(searchCriterias).forEach(([key, value]) => {
      if (value !== undefined) {
        url += `&${key}=${encodeURIComponent(value)}`;
      }
    });

    return defer(() =>
      this.http
        .get<CurseforgeResponse<SearchResult>>(url, {
          headers: this.headers,
          observe: 'response'
        })
        .pipe(timeout(15000))
    ).pipe(
      this.createRetryStrategy(3, 1000),
      map((resp) => {
        this.trackRateLimit(resp.headers);
        return resp.body!.data;
      }),
      catchError(this.createErrorHandler<SearchResult>())
    );
  }

  /**
   * Returns the changelog for a specific mod file
   * @param modId The ID of the mod
   * @param fileId The ID of the file
   * @returns Observable containing the changelog HTML string or an AnnotatedError
   */
  public getModFileChangelog(
    modId: number,
    fileId: number
  ): Observable<string | AnnotatedError> {
    return defer(() =>
      this.http
        .get<CurseforgeResponse<string>>(
          `${this.curseforgeAPIUrl}mods/${modId}/files/${fileId}/changelog`,
          { headers: this.headers, observe: 'response' }
        )
        .pipe(timeout(15000))
    ).pipe(
      this.createRetryStrategy(3, 1000),
      map((resp) => {
        this.trackRateLimit(resp.headers);
        return resp.body!.data;
      }),
      catchError(this.createErrorHandler<string>())
    );
  }
}
