import {GitHubModInfo, GitHubProject, GitHubRelease, GitHubRepoConfig, GitHubVersion} from './types.github';
import {catchError, firstValueFrom, map, Observable, of, switchMap, timeout} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {inject} from '@angular/core';
import {Loader} from '../../services/loader.service';
import {Modrinth} from "../modrinth/modrinth";
import {AnnotatedError, BaseApiProvider} from "../BaseApiProvider";
import {RateLimitInfo} from "../RateLimitedApi";

export class GitHub extends BaseApiProvider {
  protected override apiName = 'GitHub';
  public githubAPIUrl = 'https://api.github.com';
  public headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  private http = inject(HttpClient);

  protected override get _rateLimitInfo(): RateLimitInfo {
    return {
      limit: 60,
      remaining: 60,
      resetTime: new Date(Date.now() + 60 * 60 * 1000) // one hour reset time
    };
  }

  /**
   * Predefined GitHub repository configurations
   */
  public static REPO_CONFIGS: GitHubRepoConfig[] = GitHub.createRepoConfigs();

  private static createRepoConfigs(): GitHubRepoConfig[] {
    let configs: GitHubRepoConfig[] = [];

    const sakuraRyokoConfigs: GitHubRepoConfig[] = [
      { modName: 'litematica', modrinthPage: 'bEpr0Arc' },
      { modName: 'malilib', modrinthPage: 'GcWjdA9I' },
      { modName: 'minihud', modrinthPage: 'UMxybHE8' },
      { modName: 'tweakeroo', modrinthPage: 't5wuYk45' },
      { modName: 'itemscroller', modrinthPage: 'JygyCSA4' },
      { modName: 'servux', modrinthPage: 'zQhsx8KF' }
    ].map(({ modName, modrinthPage }) => ({
      owner: 'sakura-ryoko',
      repo: modName,
      loader: Loader.fabric,
      pattern: new RegExp(`^${modName}.*?-.+?-.+?-sakura.\\d+?.jar$`, 'i'),
      modrinthPage
    }));

    configs = configs.concat(sakuraRyokoConfigs)

    return configs;
  }

  /**
   * Check if error is rate limit related (API-specific implementation)
   */
  protected override isRateLimitError(error: any): boolean {
    return !!(error && error.status === 429 || error.status == 403);
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
      this.createRetryStrategy(3, 1000),
      map((resp) => {
        this.trackRateLimit(resp.headers);
        return resp.body!.map(release => ({
          ...release,
          created_at: release.created_at,
          published_at: release.published_at
        }));
      }),
      catchError(this.createErrorHandler<GitHubRelease[] | AnnotatedError>())
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
