import {
  AnnotatedError,
  Modpack,
  Project,
  ProjectType,
  SearchProjectsParams,
  SearchResult,
  Version
} from "./types.modrinth";
import {
  bufferTime,
  catchError, defaultIfEmpty,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  share,
  Subject,
  switchMap,
  take, tap
} from "rxjs";
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpResponse} from "@angular/common/http";
import Swal from "sweetalert2";
import {inject} from "@angular/core";
import * as JSZip from "jszip";


export class Modrinth {
  private static _instance: Modrinth;

  public modrinthAPIUrl = 'https://api.modrinth.com/v2';  // Modrinth API Endpoint
  public headers = {
    "Access-Control-Allow-Origin": this.modrinthAPIUrl,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };  // Headers for the requests

  private _rateLimit_Limit: number = 300;  // Rate limit maximum per minute
  private _rateLimit_Remaining: number = 300;  // Requests remaining
  private _rateLimit_Reset: number = 0;  // Seconds until the rate limit resets
  private sha1 = require('js-sha1');  // SHA1 hashing function
  private intervalRequestStart: Date | null = null; // Date of the first request in the current interval

  public bufferDelay = 1000;

  private getVersionBuffer = new Subject<string>();
  private getVersionBufferResolver = this.getVersionBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap(hashes => this.getVersionsFromHashes(hashes)),
    share(),
  );

  private getProjectBuffer = new Subject<string>();
  private getProjectBufferResolver = this.getProjectBuffer.pipe(
    bufferTime(this.bufferDelay),
    switchMap(ids => this.getProjects(ids)),
    share(),
  );

  constructor() {
    this.getVersionBufferResolver.subscribe();
    this.getProjectBufferResolver.subscribe();
  }

  private http = inject(HttpClient);

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  get rateLimit_Limit(): number {
    return this._rateLimit_Limit;
  }

  get rateLimit_Remaining(): number {
    return this._rateLimit_Remaining;
  }

  get rateLimit_Reset(): number {
    return this._rateLimit_Reset;
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
      let responseHeaders = error.headers;
      this._rateLimit_Limit = parseInt(<string>responseHeaders.get('X-RateLimit-Limit'));
      this._rateLimit_Remaining = parseInt(<string>responseHeaders.get('X-RateLimit-Remaining'));
      this._rateLimit_Reset = parseInt(<string>responseHeaders.get('X-RateLimit-Reset'));
    }

    this._rateLimit_Remaining = -1;
    console.log(`Rate limit reached. Wait for ${this._rateLimit_Reset} seconds before retrying.`);
    let timerInterval: NodeJS.Timer;
    // Fire a sweet alert
    Swal.fire({
      position: 'top-start',
      icon: 'error',
      title: 'Rate Limit Exceeded',
      html: `Modrinths rate limit was reached, please try again in <b>${this._rateLimit_Reset}</b> seconds${error.status == 0 ? ' (approximated)' : ''}.`,
      showConfirmButton: false,
      timer: this._rateLimit_Reset * 1000,
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
    })

    return of({error: error} as T);
  }

  /**
   * Returns an error handler, that handles the rate limit of the Modrinth API
   */
  private errorHandler<T>() {
    return (error: HttpErrorResponse): Observable<T> => {
      if (error.status == 429) {
        return this.rateLimitHandler(error);
      }

      if (this._rateLimit_Remaining == 0 || error.status == 0 && this._rateLimit_Remaining != -1) {
        // The workaround (client side tracking of the rate limit) might be wrong. In this case the status is 0
        let statusCase = this._rateLimit_Remaining != 0;
        if (statusCase) {
          this._rateLimit_Reset = 30;
          console.log(this._rateLimit_Remaining);
        }

        this.rateLimitHandler(error);

        if (statusCase) setTimeout(() => this._rateLimit_Remaining = 0, 30 * 1000)
      }
      return of({error: error} as T);
    };
  }

  /**
   * Adjusts the rate limit of the Modrinth API
   *
   * The Modrinth API has a rate limit of 300 requests per minute. This function reduces the remaining requests by 1
   * and starts a timer that resets the remaining requests to 300 after 60 seconds.
   *
   * NOTE: This is a workaround as the API does not return the rate limit headers (CORS issue). catchError() should be in charge of this.
   * TODO: Remove this function after fixing the CORS issue
   * @private
   */
  private adjustRateLimit(headers?: HttpHeaders) {
    if (headers != null && headers.get('X-RateLimit-Limit') != null) {
      this._rateLimit_Limit = parseInt(<string>headers.get('X-RateLimit-Limit'));
      this._rateLimit_Remaining = parseInt(<string>headers.get('X-RateLimit-Remaining'));
      this._rateLimit_Reset = parseInt(<string>headers.get('X-RateLimit-Reset'));

      console.log(`Rate limit: ${this._rateLimit_Remaining}/${this._rateLimit_Limit} (Reset in ${this._rateLimit_Reset}s)`);

      if (this.intervalRequestStart != null) return  // If the interval is already running, return
    } else {
      if (this._rateLimit_Remaining > 0) this._rateLimit_Remaining -= 1;  // Reduce the remaining requests by 1
      if (this.intervalRequestStart != null) return  // If the interval is already running, return

      const temp = new Date();
      this.intervalRequestStart = temp;
      this._rateLimit_Reset = 60;
    }
    setInterval(() => {
      if (this._rateLimit_Reset <= 0) {
        this.intervalRequestStart = null;
        this._rateLimit_Remaining = 300;
        // @ts-ignore
        clearInterval(this);
      } else {
        this._rateLimit_Reset -= 1;
      }
    }, 1000);
  }

  private parseProject(project: Project): Project {
    project.published = new Date(project.published);
    project.updated = new Date(project.updated);
    if (project.approved != null) project.approved = new Date(project.approved);
    return project;
  }

  private parseVersion(version: Version): Version {
    version.date_published = new Date(version.date_published);
    return version;
  }

  private parseVersions(versions: Version[]): Version[] {
    return versions.map(this.parseVersion);
  }

  public getProjects(ids: string[]): Observable<{ [hash: string]: Project | AnnotatedError }> {
    if (ids.length == 0) {
      return of({});
    }

    let url = `${this.modrinthAPIUrl}/projects?ids=["${ids.join('","')}"]`;
    return this.http.get<Project[]>(url, {headers: this.headers, observe: 'response'}).pipe(
      map(resp => {
        // Adjust the rate limit based on the response headers
        this.adjustRateLimit(resp.headers);
        // Process the response body
        let projects = resp.body!;
        let result: { [hash: string]: Project | AnnotatedError } = {};
        projects.forEach(project => {
          result[project.id] = this.parseProject(project);
        });
        return result;
      }),
      catchError(
        this.errorHandler<{ [hash: string]: Project | AnnotatedError }>()
      ));
  }

  /**
   * Returns the project with the given id
   * @param id The id of the project
   */
  public getProject(id: string): Observable<Project | AnnotatedError> {
    this.getProjectBuffer.next(id);

    return this.getProjectBufferResolver.pipe(
      filter(projects => projects[id] != undefined),
      map(projects => projects[id]),
      defaultIfEmpty({ error: { message: 'Project not found', status: 404 } } as AnnotatedError),
      take(1)
    );
  }

  /**
   * Returns the versions of the project with the given id
   * @param id The id of the project
   * @param version The accepted game version
   * @param loaders The accepted loaders
   */
  public getVersionsFromId(id: string, version: string, loaders: string[]): Observable<Version[] | AnnotatedError> {
    const url = `${this.modrinthAPIUrl}/project/${id}/version?game_versions=["${version}"]` + (loaders.length ? `&loaders=["${loaders.map(loader => loader.toLowerCase()).join('","')}"]` : "")
    return this.http.get<Version[]>(url, {headers: this.headers, observe: 'response'})
      .pipe(
        map((resp: HttpResponse<Version[]>) => {
          // Adjust the rate limit based on the response headers
          this.adjustRateLimit(resp.headers);
          // Process the response body
          return this.parseVersions(resp.body!);
        }),
        catchError(this.errorHandler<Version[] | AnnotatedError>())
      );
  }

  /**
   * Returns all versions for the given hashes as a map
   * @param hashes The hashes of the versions
   */
  public getVersionsFromHashes(hashes: string[]): Observable<{ [hash: string]: Version | AnnotatedError }> {
    if (hashes.length == 0) {
      return of({});
    }

    const url = `${this.modrinthAPIUrl}/version_files`;
    return this.http.post<{ [hash: string]: Version | AnnotatedError }>(url, {
      headers: this.headers,
      hashes: hashes,
      algorithm: 'sha1'
    }, {observe: 'response'})
      .pipe(
        map(resp => {
          // Adjust the rate limit based on the response headers
          this.adjustRateLimit(resp.headers);
          // Process the response body
          let versions = resp.body!;
          for (const hash of hashes) {
            if (versions[hash] instanceof Object) {
              versions[hash] = this.parseVersion(versions[hash] as Version);
            } else {
              versions[hash] = {error: versions[hash] ?? {message: "Unknown error", status: 404}} as AnnotatedError;
            }
          }
          return versions as { [hash: string]: Version | AnnotatedError }
        }),
        catchError(this.errorHandler<{ [hash: string]: Version | AnnotatedError }>())
      );
  }

  /**
   * Returns the version with the given hash
   * @param hash The sha-1 hash of the binary representation of the mod file
   */
  public getVersionFromHash(hash: string): Observable<Version | AnnotatedError> {
    this.getVersionBuffer.next(hash);

    return this.getVersionBufferResolver.pipe(
      filter(versions => versions[hash] != undefined),
      map(versions => versions[hash]),
      take(1)
    );
  }

  /**
   * Returns the version from the given buffer (binary representation of the mod file)
   * @param buffer The binary representation of the mod file
   */
  public getVersionFromBuffer(buffer: ArrayBuffer): Observable<Version | AnnotatedError> {
    const fileHash = this.sha1(buffer);
    return this.getVersionFromHash(fileHash);
  }

  public searchProject(params: SearchProjectsParams): Observable<SearchResult | AnnotatedError> {
    let httpParams = new HttpParams();

    // Add required query parameter
    httpParams = httpParams.set('query', params.query);

    // Optional parameters - add them only if they are defined
    if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) httpParams = httpParams.set('offset', params.offset.toString());
    if (params.index) httpParams = httpParams.set('index', params.index);
    if (params.license) httpParams = httpParams.set('license', params.license);
    if (params.project_type) httpParams = httpParams.set('project_type', params.project_type);
    if (params.client_side) httpParams = httpParams.set('client_side', params.client_side);
    if (params.server_side) httpParams = httpParams.set('server_side', params.server_side);
    if (params.featured !== undefined) httpParams = httpParams.set('featured', params.featured.toString());

    // Arrays (facets, versions, categories) - add them if they have values
    if (params.facets && params.facets.length > 0) {
      httpParams = httpParams.set('facets', JSON.stringify(params.facets));
    }
    if (params.versions && params.versions.length > 0) {
      httpParams = httpParams.set('versions', params.versions.join(','));
    }
    if (params.categories && params.categories.length > 0) {
      httpParams = httpParams.set('categories', params.categories.join(','));
    }

    // Make the HTTP GET request with the constructed parameters
    return this.http.get<SearchResult>(`${this.modrinthAPIUrl}/search`, {params: httpParams}).pipe(
      catchError((error) => {
        // Wrap the error in an AnnotatedError and return it
        return of({error} as AnnotatedError);
      })
    );
  }

  public async parseMrpack(buffer: ArrayBuffer): Promise<Modpack | AnnotatedError> {
    // Load the zip file from the provided ArrayBuffer
    const zip = await new JSZip().loadAsync(buffer);

    // Check if the 'modrinth.index.json' file exists in the archive
    const indexFile = zip.file('modrinth.index.json');
    if (!indexFile) {
      return {error: {message: 'modrinth.index.json not found in the archive', status: 404}};
    }

    // Parse the JSON content of 'modrinth.index.json'
    const indexData = await indexFile.async('string');
    const indexJson = JSON.parse(indexData);

    // Extract fields from indexJson to create the Modpack object
    const modpack: Modpack = {
      formatVersion: indexJson.formatVersion,
      name: indexJson.name,
      versionId: indexJson.versionId,
      dependencies: indexJson.dependencies || [],
      game: indexJson.game,
      files: indexJson.files.map((file: any) => ({
        path: file.path,
        hashes: file.hashes,
        downloads: file.downloads,
        env: file.env
      }))
    };

    return modpack;
  }

  public async searchMrpackProjectId(modpack: Modpack): Promise<string | AnnotatedError> {
    // Search for the project name in Modrinth to get the project id
    const searchResult = await firstValueFrom(this.searchProject({
      query: modpack.name,
      project_type: ProjectType.MODPACK
    }));

    // Check if the search result is an error
    if (this.isAnnotatedError(searchResult)) {
      return searchResult;
    } else {
      // Check if the search result has hits
      if (searchResult.hits.length > 0) {
        // Iterate over the hits to find the project with the same name as the modpack
        for (const hit of searchResult.hits) {
          if (hit.title === modpack.name) {
            return hit.project_id;
          }
        }
      }
    }

    return {error: {message: 'No project id found in the dependencies', status: 404}};
  }
}
