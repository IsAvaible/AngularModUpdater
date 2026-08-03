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
  forkJoin,
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

  private bufferDelay = 100;

  private getVersionBuffer = new Subject<string>();
  private getVersionBufferResolver = this.getVersionBuffer.pipe(
    bufferTime(this.bufferDelay),
    filter((hashes) => hashes.length > 0),
    mergeMap((hashes) => this.getVersionsFromHashes(hashes)),
    share()
  );

  private getProjectBuffer = new Subject<string>();
  private getProjectBufferResolver = this.getProjectBuffer.pipe(
    bufferTime(this.bufferDelay),
    filter((ids) => ids.length > 0),
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
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return of({});
    }

    if (uniqueIds.length > 100) {
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueIds.length; i += 100) {
        chunks.push(uniqueIds.slice(i, i + 100));
      }
      return forkJoin(chunks.map((chunk) => this.fetchProjectsChunk(chunk))).pipe(
        map((results: any[]) => Object.assign({}, ...results))
      );
    }

    return this.fetchProjectsChunk(uniqueIds);
  }

  private fetchProjectsChunk(
    ids: string[]
  ): Observable<{ [hash: string]: ModrinthProject | AnnotatedError }> {
    let url = `${this.modrinthAPIUrl}/projects`;
    const params = new HttpParams().set('ids', JSON.stringify(ids));
    return this.http
      .get<ModrinthProject[]>(url, { headers: this.headers, params, observe: 'response' })
      .pipe(
        timeout(10000),
        this.createRetryStrategy(3, 1000),
        map((resp) => {
          this.trackRateLimit(resp.headers);
          let projects = resp.body!;
          let result: { [hash: string]: ModrinthProject | AnnotatedError } = {};

          projects.forEach((project) => {
            const parsed = this.parseProject(project);
            if (!this.isAnnotatedError(parsed)) {
              parsed.project_url = `https://modrinth.com/project/${project.id}`;
            }
            result[project.id] = parsed;
            if (project.slug) {
              result[project.slug] = parsed;
            }
          });

          ids.forEach((id) => {
            if (result[id] === undefined) {
              result[id] = {
                error: {
                  message: `Project not found for id or slug: ${id}`,
                  status: 404
                }
              } as AnnotatedError;
            }
          });

          return result;
        }),
        catchError((error) => {
          const status = error?.status || 500;
          const message = error?.message || 'Error fetching projects';
          const errObj: AnnotatedError = { error: { message, status } };
          const result: { [hash: string]: AnnotatedError } = {};
          ids.forEach((id) => (result[id] = errObj));
          return of(result);
        })
      );
  }

  /**
   * Returns the project with the given id
   * @param id The id of the project
   */
  public getProject(id: string): Observable<ModrinthProject | AnnotatedError> {
    this.getProjectBuffer.next(id);

    return this.getProjectBufferResolver.pipe(
      filter((projects) => id in projects),
      map((projects) => projects[id]),
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
    let params = new HttpParams()
      .set('game_versions', JSON.stringify([version]));

    if (loaders && loaders.length > 0) {
      params = params.set(
        'loaders',
        JSON.stringify(loaders.map((loader) => loader.toLowerCase()))
      );
    }

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
    const uniqueHashes = [...new Set(hashes)];
    if (uniqueHashes.length === 0) {
      return of({});
    }

    if (uniqueHashes.length > 100) {
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueHashes.length; i += 100) {
        chunks.push(uniqueHashes.slice(i, i + 100));
      }
      return forkJoin(chunks.map((chunk) => this.fetchVersionsFromHashesChunk(chunk))).pipe(
        map((results: any[]) => Object.assign({}, ...results))
      );
    }

    return this.fetchVersionsFromHashesChunk(uniqueHashes);
  }

  private fetchVersionsFromHashesChunk(
    hashes: string[]
  ): Observable<{ [hash: string]: ModrinthVersion | AnnotatedError }> {
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
          let versions = resp.body!;
          for (const hash of hashes) {
            if (versions[hash] instanceof Object) {
              versions[hash] = this.parseVersion(
                versions[hash] as ModrinthVersion
              );
            } else {
              versions[hash] = {
                error: versions[hash] ?? {
                  message: 'Hash not found',
                  status: 404
                }
              } as unknown as AnnotatedError;
            }
          }
          return versions;
        }),
        catchError((error) => {
          const status = error?.status || 500;
          const message = error?.message || 'Error fetching version files';
          const errObj: AnnotatedError = { error: { message, status } };
          const result: { [hash: string]: AnnotatedError } = {};
          hashes.forEach((hash) => (result[hash] = errObj));
          return of(result);
        })
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
      filter((versions) => hash in versions),
      map((versions) => versions[hash]),
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
        project_type: ProjectType.ModPack
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
