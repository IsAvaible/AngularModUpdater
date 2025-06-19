import {
  AnnotatedError,
  GitHubModInfo,
  GitHubProject,
  GitHubRelease,
  GitHubRepoConfig,
  GitHubVersion
} from './types.github';
import {catchError, delay, firstValueFrom, map, Observable, of, retryWhen, scan, switchMap, timeout} from 'rxjs';
import {HttpClient, HttpErrorResponse, HttpResponse} from '@angular/common/http';
import {inject} from '@angular/core';
import {Loader} from '../../services/loader.service';
import Swal from 'sweetalert2';
import {Modrinth} from "../modrinth/modrinth";

export class GitHub {
  public githubAPIUrl = 'https://api.github.com';
  public headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  private _rateLimit_Limit: number = 60;
  private _rateLimit_Remaining: number = 60;
  private _rateLimit_Reset: number = 0;

  constructor() {
  }

  private http = inject(HttpClient);
  /**
   * Predefined GitHub repository configurations
   */
  public static REPO_CONFIGS: GitHubRepoConfig[] = [];
  static {
    const modrinthPages = ['bEpr0Arc', 'GcWjdA9I', 'UMxybHE8', 't5wuYk45', 'JygyCSA4', 'zQhsx8KF']
    // slugs don't work because of the getProjectBuffer in modrinth.ts, which causes the modrinth.getProject request to stall for some reason

    let i = 0;
    for (const modName of ['litematica', 'malilib', 'minihud', 'tweakeroo', 'itemscroller', 'servux']) {
      GitHub.REPO_CONFIGS.push({
        owner: 'sakura-ryoko',
        repo: modName,
        loader: Loader.fabric,
        pattern: new RegExp(`^${modName}.*?-.+?-.+?-sakura.\\d+?.jar$`, 'i'),
        modrinthPage: modrinthPages[i++]
      });
    }
  }

  /**
   * Checks if the given object is an annotated error
   * @param object The object to check
   */
  public isAnnotatedError(object: any): object is AnnotatedError {
    return object && !!((object as AnnotatedError).error);
  }

  /**
   * Adjusts the rate limit based on response headers
   * @param headers The response headers
   */
  private adjustRateLimit(headers: any) {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (limit) this._rateLimit_Limit = parseInt(limit);
    if (remaining) this._rateLimit_Remaining = parseInt(remaining);
    if (reset) this._rateLimit_Reset = parseInt(reset) - Math.floor(Date.now() / 1000);
  }

  private rateLimitHandler<T>(error: HttpErrorResponse): Observable<T> {
    if (error.status === 403 && error.headers.get('X-RateLimit-Remaining') === '0') {
      const resetTime = parseInt(error.headers.get('X-RateLimit-Reset') || '0');
      const waitTime = Math.max(resetTime - Math.floor(Date.now() / 1000), 60);

      console.log(`GitHub rate limit reached. Wait for ${waitTime} seconds before retrying.`);

      Swal.fire({
        position: 'top-end',
        icon: 'warning',
        title: 'GitHub Rate Limit',
        text: `Rate limit reached. Waiting ${waitTime} seconds...`,
        showConfirmButton: false,
        timer: 3000,
        backdrop: 'rgba(0, 0, 0, 0.0)',
      });
    }

    return of({error: error} as T);
  }

  /**
   * Returns an error handler that handles GitHub API errors
   */
  private errorHandler<T>() {
    return (error: HttpErrorResponse): Observable<T> => {
      if (error.status === 403) {
        return this.rateLimitHandler(error);
      }
      return of({error: error} as T);
    };
  }

  /**
   * Retries the request with a backoff strategy
   * @param maxRetries The maximum number of retries
   * @param delayMs The delay in milliseconds
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

  /**
   * Gets releases for a GitHub repository
   */
  public getReleases(config: GitHubRepoConfig): Observable<GitHubRelease[] | AnnotatedError> {
    const owner = config.owner;
    const repo = config.repo;
    const url = `${this.githubAPIUrl}/repos/${owner}/${repo}/releases`;

    return this.http.get<GitHubRelease[]>(url, {
      headers: this.headers,
      observe: 'response'
    }).pipe(
      timeout(10000),
      // @ts-ignore
      this.retryWithBackoff(3, 1000),
      map((resp: HttpResponse<GitHubRelease[]>) => {
        this.adjustRateLimit(resp.headers);
        return resp.body!.map(release => ({
          ...release,
          created_at: release.created_at,
          published_at: release.published_at
        }));
      }),
      catchError(this.errorHandler<GitHubRelease[] | AnnotatedError>())
    );
  }

  /**
   * Finds matching JAR asset in a release based on pattern
   * @param release The GitHub release
   * @param pattern The RegExp pattern to match
   */
  public findMatchingAsset(release: GitHubRelease, pattern: RegExp) {
    return release.assets.find(asset =>
      asset.name.endsWith('.jar') && pattern.test(asset.name)
    );
  }

  /**
   * Gets mod information for a filename that matches GitHub patterns
   * @param filename The mod filename to check
   * @param loader The current loader
   * @param mcVersion The current selected minecraft version
   * @param modrinth The client to fetch data from Modrinth with
   */
  public getModInfoForFile(filename: string, loader: Loader, mcVersion: string, modrinth: Modrinth): Observable<GitHubModInfo | null> {
    const matchingConfig = GitHub.REPO_CONFIGS.find(config =>
      config.loader === loader && config.pattern.test(filename)
    );

    if (!matchingConfig) {
      return of(null);
    }

    return this.getReleases(matchingConfig).pipe(
      switchMap(async releases => {
        if (this.isAnnotatedError(releases)) {
          return null;
        }

        await this.findGithubInfoFromModrinth(matchingConfig, modrinth);

        const validReleases = releases
          .filter(release => !release.draft && !release.prerelease)
          .filter(release => release.name.includes(mcVersion))
          .filter(release => this.findMatchingAsset(release, matchingConfig.pattern));

        if (validReleases.length === 0) {
          return null;
        }

        const id = `${matchingConfig.owner}/${matchingConfig.repo}`;
        const project: GitHubProject = {
          id: id,
          title: matchingConfig.title || matchingConfig.repo,
          description: matchingConfig.description || 'Github Repository',
          project_url: `https://github.com/${id}`,
          downloads: validReleases.reduce((sum, release) =>
            sum + release.assets.reduce((assetSum, asset) => assetSum + asset.download_count, 0), 0
          ),
          updated: new Date(Math.max(...validReleases.map(r => new Date(r.published_at).getTime()))),
          versions: validReleases.map(r => r.tag_name),
          loaders: [matchingConfig.loader]
        };

        const versions: GitHubVersion[] = validReleases.map(release => {
          const asset = this.findMatchingAsset(release, matchingConfig.pattern)!;
          const versionName = (release.name || release.tag_name);

          return {
            name: versionName,
            version_number: release.tag_name,
            changelog: release.body || '',
            date_published: new Date(release.published_at),
            downloads: asset.download_count,
            files: [{
              url: asset.browser_download_url,
              filename: asset.name,
              primary: true,
              size: asset.size
            }],
            release_url: release.html_url
          };
        });

        return {
          project,
          versions,
          config: matchingConfig
        };
      })
    );
  }

  private foundInfo = new Set();

  private async findGithubInfoFromModrinth(config: GitHubRepoConfig, modrinth: Modrinth) {
    const modrinthPage = config.modrinthPage;
    if (!modrinthPage || this.foundInfo.has(modrinthPage)) return;
    this.foundInfo.add(modrinthPage);

    const modrinthProject = await firstValueFrom(modrinth.getProject(modrinthPage));
    if (modrinth.isAnnotatedError(modrinthProject)) return;

    config.title = modrinthProject.title;
    config.description = modrinthProject.description;
    config.client = modrinthProject.client_side;
    config.server = modrinthProject.server_side;
    config.icon_url = modrinthProject.icon_url || undefined;
  }
}
