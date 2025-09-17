import {
  CurseforgeFile,
  CurseforgeMod,
  CurseforgeResponse,
  SearchCriterias,
  SearchResult
} from './types.curseforge';
import {
  bufferTime,
  catchError,
  filter,
  map,
  Observable,
  of,
  share,
  Subject,
  switchMap,
  take,
  timeout
} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import compute_fingerprint from './fingerprint';
import { AnnotatedError, BaseApiProvider } from '../BaseApiProvider';

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

  private getFileBuffer = new Subject<number>();
  private getFileBufferResolver = this.getFileBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap((fingerprints) => this.getFilesFromFingerprints(fingerprints)),
    share()
  );

  private getModBuffer = new Subject<number>();
  private getModBufferResolver = this.getModBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap((ids) => this.getMods(ids)),
    share()
  );

  private getFileByIdBuffer = new Subject<number>();
  private getFileByIdBufferResolver = this.getFileByIdBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap((fileIds) => this.getFilesById(fileIds)),
    share()
  );

  protected setupBuffering() {
    this.getFileBufferResolver.subscribe();
    this.getModBufferResolver.subscribe();
    this.getFileByIdBufferResolver.subscribe();
  }

  constructor() {
    super();
    this.setupBuffering();
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
    if (ids.length === 0) {
      return of({});
    }

    return this.http
      .post<
        CurseforgeResponse<CurseforgeMod[]>
      >(`${this.curseforgeAPIUrl}mods`, { modIds: ids }, { headers: this.headers, observe: 'response' })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => {
          let result: { [id: number]: CurseforgeMod | AnnotatedError } = {};
          resp.body!.data.forEach((mod) => {
            result[mod.id] = this.parseMod(mod);
          });
          return result;
        }),
        catchError(
          this.createErrorHandler<{
            [id: number]: CurseforgeMod | AnnotatedError;
          }>()
        )
      );
  }

  /**
   * Returns a single mod by ID
   * @param id Mod ID
   */
  public getMod(id: number): Observable<CurseforgeMod | AnnotatedError> {
    this.getModBuffer.next(id);

    return this.getModBufferResolver.pipe(
      filter((mods) => mods[id] != undefined),
      map((mods) => mods[id]),
      take(1)
    );
  }

  /**
   * Returns files by their fingerprints
   * @param fingerprints Array of file fingerprints
   */
  private getFilesFromFingerprints(
    fingerprints: number[]
  ): Observable<{ [fingerprint: number]: CurseforgeFile | AnnotatedError }> {
    if (fingerprints.length === 0) {
      return of({});
    }

    return this.http
      .post<
        CurseforgeResponse<{
          exactMatches: { file: CurseforgeFile; id: number }[];
        }>
      >(
        `${this.curseforgeAPIUrl}fingerprints`,
        { fingerprints: fingerprints },
        { headers: this.headers, observe: 'response' }
      )
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => {
          let result: {
            [fingerprint: number]: CurseforgeFile | AnnotatedError;
          } = {};
          fingerprints.forEach((fingerprint) => {
            const res = resp.body!.data.exactMatches.find(
              (item) => item.file.fileFingerprint === fingerprint
            );
            if (res) {
              result[fingerprint] = res.file;
            } else {
              result[fingerprint] = {
                error: { message: 'Not found', status: 404 }
              };
            }
          });
          return result;
        }),
        catchError(
          this.createErrorHandler<{
            [fingerprint: number]: CurseforgeFile | AnnotatedError;
          }>()
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
    if (fileIds.length === 0) {
      return of({});
    }

    return this.http
      .post<
        CurseforgeResponse<CurseforgeFile[]>
      >(`${this.curseforgeAPIUrl}mods/files`, { fileIds: fileIds }, { headers: this.headers, observe: 'response' })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => {
          let result: { [fileId: number]: CurseforgeFile | AnnotatedError } =
            {};
          resp.body!.data.forEach((file) => {
            result[file.id] = this.parseFile(file);
          });
          return result;
        }),
        catchError(
          this.createErrorHandler<{
            [fileId: number]: CurseforgeFile | AnnotatedError;
          }>()
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
    this.getFileBuffer.next(fingerprint);

    return this.getFileBufferResolver.pipe(
      filter((files) => files[fingerprint] != undefined),
      map((files) => files[fingerprint]),
      take(1)
    );
  }

  /**
   * Returns a single file by ID
   * @param fileId File ID
   */
  public getFileFromIndex(
    fileId: number
  ): Observable<CurseforgeFile | AnnotatedError> {
    this.getFileByIdBuffer.next(fileId);

    return this.getFileByIdBufferResolver.pipe(
      filter((files) => files[fileId] != undefined),
      map((files) => files[fileId]),
      take(1)
    );
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

    return this.http
      .get<CurseforgeResponse<SearchResult>>(url, {
        headers: this.headers,
        observe: 'response'
      })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => resp.body!.data),
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
    return this.http
      .get<
        CurseforgeResponse<string>
      >(`${this.curseforgeAPIUrl}mods/${modId}/files/${fileId}/changelog`, { headers: this.headers, observe: 'response' })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => resp.body!.data),
        catchError(this.createErrorHandler<string>())
      );
  }
}
