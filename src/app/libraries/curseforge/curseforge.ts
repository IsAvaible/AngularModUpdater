import {
  AnnotatedError,
  SearchCriterias,
  CurseforgeResponse,
  CurseforgeFile,
  CurseforgeMod,
  SearchResult
} from "./types.curseforge";
import {
  bufferTime,
  catchError,
  delay,
  filter,
  map,
  Observable,
  of,
  retryWhen,
  scan,
  share,
  Subject,
  switchMap,
  take,
  timeout
} from "rxjs";
import {HttpClient, HttpErrorResponse, HttpResponse} from "@angular/common/http";
import {inject} from "@angular/core";
import Swal from "sweetalert2";
import compute_fingerprint from "./fingerprint";

/**
 * Wrapper around the Curseforge API.
 *
 * @link https://docs.curseforge.com/rest-api/
 */
export class Curseforge {
  private static _instance: Curseforge;
  public curseforgeAPIUrl = "https://api.curseforge.com/v1/";
  public headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-api-key": window.atob("JDJhJDEwJEN0ZmFPQTRIT1phbXZTMXphVHUwLnVoTS51VzlNNzBQOGRyZnF2WUptOFNXdy5yWTlPSk1t")
  };

  public bufferDelay = 2000;

  private getFileBuffer = new Subject<number>();
  private getFileBufferResolver = this.getFileBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap(fingerprints => this.getFilesFromFingerprints(fingerprints)),
    share(),
  );

  private getModBuffer = new Subject<number>();
  private getModBufferResolver = this.getModBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap(ids => this.getMods(ids)),
    share(),
  );

  private getFileByIdBuffer = new Subject<number>();
  private getFileByIdBufferResolver = this.getFileByIdBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap(fileIds => this.getFilesById(fileIds)),
    share(),
  );

  constructor() {
    this.getFileBufferResolver.subscribe();
    this.getModBufferResolver.subscribe();
    this.getFileByIdBufferResolver.subscribe();
  }

  private http = inject(HttpClient);

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  /**
   * Checks if the given object is an annotated error
   * @param object The object to check
   */
  public isAnnotatedError(object: any): object is AnnotatedError {
    return object && !!((object as AnnotatedError).error);
  }

  private rateLimitHandler<T>(error: HttpErrorResponse): Observable<T> {
    if (error.status == 429) {
      let retryAfter = parseInt(error.headers.get('Retry-After') || '30');
      console.log(`Rate limit reached. Wait for ${retryAfter} seconds before retrying.`);
      let timerInterval: NodeJS.Timer;

      Swal.fire({
        position: 'top-start',
        icon: 'error',
        title: 'Rate Limit Exceeded',
        html: `CurseForge rate limit was reached, please try again in <b>${retryAfter}</b> seconds.`,
        showConfirmButton: false,
        timer: retryAfter * 1000,
        timerProgressBar: true,
        backdrop: false,
        didOpen: () => {
          const b: HTMLElement = Swal.getHtmlContainer()!.querySelector('b')!;
          timerInterval = setInterval(() => {
            b.textContent = String(Math.round(Swal.getTimerLeft()! / 1000));
          }, 100)
        },
        willClose: () => {
          clearInterval(timerInterval)
        }
      });
    }
    return of({error: error} as T);
  }

  /**
   * Returns an error handler that handles API errors
   */
  private errorHandler<T>() {
    return (error: HttpErrorResponse): Observable<T> => {
      if (error.status == 429) {
        return this.rateLimitHandler(error);
      }
      return of({error: error} as T);
    };
  }

  /**
   * Retries the request with a backoff strategy
   * @param maxRetries The maximum number of retries
   * @param delayMs The delay in milliseconds
   * @private
   */
  private retryWithBackoff(maxRetries: number, delayMs: number) {
    return retryWhen(errors =>
      errors.pipe(
        scan((acc, error) => {
          if (acc >= maxRetries) throw error;
          return acc + 1;
        }, 0),
        delay(delayMs)
      )
    );
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
  public getMods(ids: number[]): Observable<{ [id: number]: CurseforgeMod | AnnotatedError }> {
    if (ids.length === 0) {
      return of({});
    }

    return this.http.post<CurseforgeResponse<CurseforgeMod[]>>(
      `${this.curseforgeAPIUrl}mods`,
      { modIds: ids },
      { headers: this.headers, observe: 'response' }
    ).pipe(
      timeout(10000),
      // @ts-ignore
      this.retryWithBackoff(3, 1000),
      map((resp: HttpResponse<CurseforgeResponse<CurseforgeMod[]>>) => {
        let result: { [id: number]: CurseforgeMod | AnnotatedError } = {};
        resp.body!.data.forEach(mod => {
          result[mod.id] = this.parseMod(mod);
        });
        return result;
      }),
      catchError(this.errorHandler<{ [id: number]: CurseforgeMod | AnnotatedError }>())
    );
  }

  /**
   * Returns a single mod by ID
   * @param id Mod ID
   */
  public getMod(id: number): Observable<CurseforgeMod | AnnotatedError> {
    this.getModBuffer.next(id);

    return this.getModBufferResolver.pipe(
      filter(mods => mods[id] != undefined),
      map(mods => mods[id]),
      take(1)
    );
  }

  /**
   * Returns files by their fingerprints
   * @param fingerprints Array of file fingerprints
   */
  private getFilesFromFingerprints(fingerprints: number[]): Observable<{ [fingerprint: number]: CurseforgeFile | AnnotatedError }> {
    if (fingerprints.length === 0) {
      return of({});
    }

    return this.http.post<CurseforgeResponse<{ file: CurseforgeFile, file_id: number }[]>>(
      `${this.curseforgeAPIUrl}fingerprints`,
      { fingerprints: fingerprints },
      { headers: this.headers, observe: 'response' }
    ).pipe(
      timeout(10000),
      // @ts-ignore
      this.retryWithBackoff(3, 1000),
      map((resp: HttpResponse<CurseforgeResponse<{ exactMatches: {file: CurseforgeFile, id: number}[] }>>) => {
        let result: { [fingerprint: number]: CurseforgeFile | AnnotatedError } = {};
        fingerprints.forEach(fingerprint => {
          const res = resp.body!.data.exactMatches.find(item => item.file.fileFingerprint === fingerprint);
          if (res) {
            result[fingerprint] = res.file;
          } else {
            result[fingerprint] = { error: { message: 'Not found', status: 404 } };
          }
        })
        return result;
      }),
      catchError(this.errorHandler<{ [fingerprint: number]: CurseforgeFile | AnnotatedError }>())
    );
  }

  /**
   * Returns files by their IDs
   * @param fileIds Array of file IDs
   */
  private getFilesById(fileIds: number[]): Observable<{ [fileId: number]: CurseforgeFile | AnnotatedError }> {
    if (fileIds.length === 0) {
      return of({});
    }

    return this.http.post<CurseforgeResponse<CurseforgeFile[]>>(
      `${this.curseforgeAPIUrl}mods/files`,
      { fileIds: fileIds },
      { headers: this.headers, observe: 'response' }
    ).pipe(
      timeout(10000),
      // @ts-ignore
      this.retryWithBackoff(3, 1000),
      map((resp: HttpResponse<CurseforgeResponse<CurseforgeFile[]>>) => {
        let result: { [fileId: number]: CurseforgeFile | AnnotatedError } = {};
        resp.body!.data.forEach(file => {
          result[file.id] = this.parseFile(file);
        });
        return result;
      }),
      catchError(this.errorHandler<{ [fileId: number]: CurseforgeFile | AnnotatedError }>())
    );
  }

  /**
   * Finds a matching file for the given buffer
   * @param buffer The binary representation of the mod file
   */
  public getFileFromBuffer(buffer: ArrayBuffer): Observable<CurseforgeFile | AnnotatedError> {
    const fingerprint = compute_fingerprint(new Uint8Array(buffer));
    this.getFileBuffer.next(fingerprint);

    return this.getFileBufferResolver.pipe(
      filter(files => files[fingerprint] != undefined),
      map(files => files[fingerprint]),
      take(1)
    );
  }

  /**
   * Returns a single file by ID
   * @param fileId File ID
   */
  public getFileFromIndex(fileId: number): Observable<CurseforgeFile | AnnotatedError> {
    this.getFileByIdBuffer.next(fileId);

    return this.getFileByIdBufferResolver.pipe(
      filter(files => files[fileId] != undefined),
      map(files => files[fileId]),
      take(1)
    );
  }

  /**
   * Searches for mods with the given search criteria
   * @param searchCriterias The search criteria
   */
  public searchMods(searchCriterias: SearchCriterias): Observable<SearchResult | AnnotatedError> {
    let url = this.curseforgeAPIUrl + 'mods/search?gameId=432';

    Object.entries(searchCriterias).forEach(([key, value]) => {
      if (value !== undefined) {
        url += `&${key}=${encodeURIComponent(value)}`;
      }
    });

    return this.http.get<CurseforgeResponse<SearchResult>>(url, {
      headers: this.headers,
      observe: 'response'
    }).pipe(
      timeout(10000),
      // @ts-ignore
      this.retryWithBackoff(3, 1000),
      // @ts-ignore
      map(resp => resp.body!.data),
      catchError(this.errorHandler<SearchResult>())
    );
  }

  /**
   * Returns the changelog for a specific mod file
   * @param modId The ID of the mod
   * @param fileId The ID of the file
   * @returns Observable containing the changelog HTML string or an AnnotatedError
   */
  public getModFileChangelog(modId: number, fileId: number): Observable<string | AnnotatedError> {
    return this.http.get<CurseforgeResponse<string>>(
      `${this.curseforgeAPIUrl}mods/${modId}/files/${fileId}/changelog`,
      { headers: this.headers, observe: 'response' }
    ).pipe(
      timeout(10000),
      // @ts-ignore
      this.retryWithBackoff(3, 1000),
      map((resp: HttpResponse<CurseforgeResponse<string>>) => resp.body!.data),
      catchError(this.errorHandler<string>())
    );
  }
}
