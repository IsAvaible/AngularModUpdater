import {
  Modpack,
  ModrinthProject,
  ModrinthVersion,
  ProjectType,
  SearchProjectsParams,
  SearchResult
} from './types.modrinth';
import {
  bufferTime,
  catchError,
  defaultIfEmpty,
  filter,
  firstValueFrom,
  map, mergeMap,
  Observable,
  of,
  share,
  Subject,
  switchMap,
  take,
  timeout
} from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import JSZip from 'jszip';
import { sha1 } from 'js-sha1';
import { AnnotatedError, BaseApiProvider } from '../BaseApiProvider';
import { RateLimitInfo } from '../RateLimitedApi';

export class Modrinth extends BaseApiProvider {
  protected apiName = 'Modrinth';
  private static _instance: Modrinth;

  protected readonly modrinthAPIUrl = 'https://api.modrinth.com/v2'; // Modrinth API Endpoint
  protected readonly headers = {
    // Headers for the requests
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  private http = inject(HttpClient);

  protected override get _rateLimitInfo(): RateLimitInfo {
    return {
      limit: 300,
      remaining: 300,
      resetTime: new Date(Date.now() + 60 * 1000) // one minute reset time
    };
  }

  private bufferDelay = 2000;

  private getVersionBuffer = new Subject<string>();
  private getVersionBufferResolver = this.getVersionBuffer.pipe(
    bufferTime(this.bufferDelay),
    mergeMap((hashes) => this.getVersionsFromHashes(hashes)),
    share()
  );

  private getProjectBuffer = new Subject<string>();
  private getProjectBufferResolver = this.getProjectBuffer.pipe(
    bufferTime(this.bufferDelay),
    mergeMap((ids) => this.getProjects(ids)),
    share()
  );

  protected setupBuffering() {
    this.getVersionBufferResolver.subscribe();
    this.getProjectBufferResolver.subscribe();
  }

  constructor() {
    super();
    this.setupBuffering();
  }

  /**
   * Check if error is rate limit related (API-specific implementation)
   */
  protected override isRateLimitError(error: any): boolean {
    // Check if error has rate limit properties
    return !!(error && (error.status === 429 || error.status == 0));
  }

  private parseProject(project: ModrinthProject): ModrinthProject {
    return {
      ...project,
      published: new Date(project.published),
      updated: new Date(project.updated),
      approved: project.approved ? new Date(project.approved) : project.approved
    };
  }

  private parseVersion(version: ModrinthVersion): ModrinthVersion {
    version.date_published = new Date(version.date_published);
    return version;
  }

  private parseVersions(versions: ModrinthVersion[]): ModrinthVersion[] {
    return versions.map(this.parseVersion);
  }

  public getProjects(
    ids: string[]
  ): Observable<{ [hash: string]: ModrinthProject | AnnotatedError }> {
    if (ids.length == 0) {
      return of({});
    }

    let url = `${this.modrinthAPIUrl}/projects`;
    const params = new HttpParams().set('ids', JSON.stringify(ids));
    return this.http
      .get<
        ModrinthProject[]
      >(url, { headers: this.headers, params, observe: 'response' })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => {
          // Adjust the rate limit based on the response headers
          this.trackRateLimit(resp.headers);
          // Process the response body
          let projects = resp.body!;
          let result: { [hash: string]: ModrinthProject | AnnotatedError } = {};

          projects.forEach((project) => {
            result[project.id] = this.parseProject(project);
            if (!this.isAnnotatedError(result[project.id])) {
              // Add the project URL to the project object
              (result[project.id] as ModrinthProject).project_url =
                `https://modrinth.com/project/${project.id}`;
            }
          });
          return result;
        }),
        catchError(
          this.createErrorHandler<{
            [hash: string]: ModrinthProject | AnnotatedError;
          }>()
        )
      );
  }

  /**
   * Returns the project with the given id
   * @param id The id of the project
   */
  public getProject(id: string): Observable<ModrinthProject | AnnotatedError> {
    this.getProjectBuffer.next(id);

    return this.getProjectBufferResolver.pipe(
      filter((projects) => projects[id] != undefined),
      map((projects) => projects[id]),
      defaultIfEmpty({
        error: { message: 'Project not found', status: 404 }
      } as AnnotatedError),
      take(1)
    );
  }

  /**
   * Returns the versions of the project with the given id
   * @param id The id of the project
   * @param version The accepted game version
   * @param loaders The accepted loaders
   */
  public getVersionsFromId(
    id: string,
    version: string,
    loaders: string[]
  ): Observable<ModrinthVersion[] | AnnotatedError> {
    const url = `${this.modrinthAPIUrl}/project/${id}/version`;
    const params = new HttpParams()
      .set('game_versions', JSON.stringify([version]))
      .set('loaders', JSON.stringify(loaders.map((loader) => loader.toLowerCase())));

    return this.http
      .get<
        ModrinthVersion[]
      >(url, { headers: this.headers, params, observe: 'response' })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => {
          this.trackRateLimit(resp.headers);
          // Process the response body
          return this.parseVersions(resp.body!);
        }),
        catchError(
          this.createErrorHandler<ModrinthVersion[] | AnnotatedError>()
        )
      );
  }

  /**
   * Returns all versions for the given hashes as a map
   * @param hashes The hashes of the versions
   */
  public getVersionsFromHashes(
    hashes: string[]
  ): Observable<{ [hash: string]: ModrinthVersion | AnnotatedError }> {
    if (hashes.length == 0) {
      return of({});
    }

    const url = `${this.modrinthAPIUrl}/version_files`;
    return this.http
      .post<{ [hash: string]: ModrinthVersion | AnnotatedError }>(
        url,
        {
          hashes: hashes,
          algorithm: 'sha1'
        },
        { headers: this.headers, observe: 'response' }
      )
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => {
          this.trackRateLimit(resp.headers);
          // Process the response body
          let versions = resp.body!;
          for (const hash of hashes) {
            if (versions[hash] instanceof Object) {
              versions[hash] = this.parseVersion(
                versions[hash] as ModrinthVersion
              );
            } else {
              versions[hash] = {
                error: versions[hash] ?? {
                  message: 'Unknown error',
                  status: 404
                }
              } as unknown as AnnotatedError;
            }
          }
          return versions;
        }),
        catchError(
          this.createErrorHandler<{
            [hash: string]: ModrinthVersion | AnnotatedError;
          }>()
        )
      );
  }

  /**
   * Returns the version with the given hash
   * @param hash The sha-1 hash of the binary representation of the mod file
   */
  public getVersionFromHash(
    hash: string
  ): Observable<ModrinthVersion | AnnotatedError> {
    this.getVersionBuffer.next(hash);

    return this.getVersionBufferResolver.pipe(
      map(versions => versions[hash] ?? {
        error: { message: 'Hash not found in batch response', status: 404 }
      }),
      take(1)
    );
  }

  /**
   * Returns the version from the given buffer (binary representation of the mod file)
   * @param buffer The binary representation of the mod file
   */
  public getVersionFromBuffer(
    buffer: ArrayBuffer
  ): Observable<ModrinthVersion | AnnotatedError> {
    const fileHash = sha1(buffer);
    return this.getVersionFromHash(fileHash);
  }

  public searchProject(
    params: SearchProjectsParams
  ): Observable<SearchResult | AnnotatedError> {
    let httpParams = new HttpParams();

    // Add required query parameter
    httpParams = httpParams.set('query', params.query);

    // Optional parameters - add them only if they are defined
    if (params.limit !== undefined)
      httpParams = httpParams.set('limit', params.limit.toString());
    if (params.offset !== undefined)
      httpParams = httpParams.set('offset', params.offset.toString());
    if (params.index) httpParams = httpParams.set('index', params.index);
    if (params.license) httpParams = httpParams.set('license', params.license);
    if (params.project_type)
      httpParams = httpParams.set('project_type', params.project_type);
    if (params.client_side)
      httpParams = httpParams.set('client_side', params.client_side);
    if (params.server_side)
      httpParams = httpParams.set('server_side', params.server_side);
    if (params.featured !== undefined)
      httpParams = httpParams.set('featured', params.featured.toString());

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
    return this.http
      .get<SearchResult>(`${this.modrinthAPIUrl}/search`, {
        params: httpParams
      })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        catchError((error) => {
          // Wrap the error in an AnnotatedError and return it
          return of({ error } as AnnotatedError);
        })
      );
  }

  public async parseMrpack(
    buffer: ArrayBuffer,
    isJson: boolean = false
  ): Promise<Modpack | AnnotatedError> {
    let json: any;
    if (!isJson) {
      // Load the zip file from the provided ArrayBuffer
      const zip = await new JSZip().loadAsync(buffer);

      // Check if the 'modrinth.index.json' file exists in the archive
      const indexFile = zip.file('modrinth.index.json');
      if (!indexFile) {
        return {
          error: {
            message: 'modrinth.index.json not found in the archive',
            status: 404
          }
        };
      }

      // Parse the JSON content of 'modrinth.index.json'
      const indexData = await indexFile.async('string');
      json = JSON.parse(indexData);
    } else {
      json = JSON.parse(new TextDecoder().decode(buffer));
    }

    // Extract fields from indexJson to create the Modpack object
    const modpack: Modpack = {
      formatVersion: json.formatVersion,
      name: json.name,
      versionId: json.versionId,
      dependencies: json.dependencies || [],
      game: json.game,
      files: json.files.map((file: Modpack["files"][number]) => ({
        ...file
      }))
    };

    return modpack;
  }

  public async searchMrpackProjectId(
    modpack: Modpack
  ): Promise<string | AnnotatedError> {
    // Search for the project name in Modrinth to get the project id
    const searchResult = await firstValueFrom(
      this.searchProject({
        query: modpack.name,
        project_type: ProjectType.MODPACK
      })
    );

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
        return searchResult.hits[0].project_id;
      }
    }

    return {
      error: {
        message: 'No project id found in the dependencies',
        status: 404
      }
    };
  }
}
