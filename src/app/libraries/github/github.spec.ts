import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { GitHubService } from '../../services/github.service';
import { ModrinthService } from '../../services/modrinth.service';
import { GitHubRepoConfig, GitHubRelease } from './types.github';
import { Loader } from '../../services/loader.service';
import { of } from 'rxjs';
import { Status, ProjectType } from '../modrinth/types.modrinth';

describe('GitHubService (GitHub API)', () => {
  let service: GitHubService;
  let httpMock: HttpTestingController;
  let mockModrinth: jasmine.SpyObj<ModrinthService>;

  beforeEach(() => {
    mockModrinth = jasmine.createSpyObj('ModrinthService', [
      'getProject',
      'isAnnotatedError'
    ]);

    TestBed.configureTestingModule({
      providers: [
        GitHubService,
        { provide: ModrinthService, useValue: mockModrinth },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(GitHubService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getReleases', () => {
    it('should fetch repository releases from GitHub API', (done) => {
      const config: GitHubRepoConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        loader: Loader.fabric,
        pattern: /.*/,
        modrinthPage: 'abc'
      };

      const mockReleases: Partial<GitHubRelease>[] = [
        {
          name: 'Release v1.0.0',
          tag_name: 'v1.0.0',
          draft: false,
          prerelease: false,
          created_at: '2026-03-01T00:00:00Z',
          published_at: '2026-03-01T00:00:00Z',
          body: 'Changelog text',
          assets: [
            {
              name: 'test-v1.0.0.jar',
              size: 1024,
              download_count: 10,
              browser_download_url: 'http://github/download'
            } as any
          ]
        }
      ];

      service.getReleases(config).subscribe((releases) => {
        expect(Array.isArray(releases)).toBeTrue();
        expect((releases as GitHubRelease[])[0].tag_name).toBe('v1.0.0');
        done();
      });

      const req = httpMock.expectOne(
        'https://api.github.com/repos/test-owner/test-repo/releases'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockReleases as GitHubRelease[]);
    });

    it('should evict failed request from releasesCache so that subsequent call can retry', fakeAsync(() => {
      const config: GitHubRepoConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        loader: Loader.fabric,
        pattern: /.*/,
        modrinthPage: 'abc'
      };

      let result1: any;
      service.getReleases(config).subscribe((res) => (result1 = res));

      // Attempt 1 (initial)
      const req1 = httpMock.expectOne(
        'https://api.github.com/repos/test-owner/test-repo/releases'
      );
      req1.flush('Server error', { status: 500, statusText: 'Server Error' });

      // Retries with backoff (~1s, 2s, 4s)
      for (let i = 0; i < 3; i++) {
        tick(5000);
        const retryReq = httpMock.expectOne(
          'https://api.github.com/repos/test-owner/test-repo/releases'
        );
        retryReq.flush('Server error', {
          status: 500,
          statusText: 'Server Error'
        });
      }

      tick();
      expect(service.isAnnotatedError(result1)).toBeTrue();

      // Second request should make a new network call because failure was not cached
      let result2: any;
      service.getReleases(config).subscribe((res) => (result2 = res));

      const req2 = httpMock.expectOne(
        'https://api.github.com/repos/test-owner/test-repo/releases'
      );
      req2.flush([]);
      tick();
      expect(Array.isArray(result2)).toBeTrue();
    }));

    it('should distinguish GitHub 403 rate limits from other 403 errors', () => {
      const rateLimit403 = {
        status: 403,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'x-ratelimit-remaining' ? '0' : null
        }
      };
      const forbidden403 = {
        status: 403,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'x-ratelimit-remaining' ? '60' : null
        },
        message: 'Forbidden'
      };

      expect((service as any).isRateLimitError(rateLimit403)).toBeTrue();
      expect((service as any).isRateLimitError(forbidden403)).toBeFalse();
    });
  });

  describe('findMatchingAsset', () => {
    it('should find asset ending in .jar and matching pattern', () => {
      const pattern = /^test-.*\.jar$/i;
      const release: Partial<GitHubRelease> = {
        name: 'v1',
        tag_name: 'v1',
        draft: false,
        prerelease: false,
        created_at: '',
        published_at: '',
        body: '',
        assets: [
          {
            name: 'irrelevant.txt',
            size: 100,
            download_count: 0,
            browser_download_url: ''
          } as any,
          {
            name: 'test-mod-1.0.jar',
            size: 500,
            download_count: 5,
            browser_download_url: 'http://asset1'
          } as any
        ]
      };

      const matched = service.findMatchingAsset(
        release as GitHubRelease,
        pattern
      );
      expect(matched).toBeDefined();
      expect(matched?.name).toBe('test-mod-1.0.jar');
      expect(matched?.browser_download_url).toBe('http://asset1');
    });
  });

  describe('getModInfoForFile', () => {
    it('should return null if file name does not match any predefined repository configs', (done) => {
      service
        .getModInfoForFile(
          'nonexistent-mod-1.20.1.jar',
          Loader.fabric,
          '1.20.1',
          mockModrinth
        )
        .subscribe((result) => {
          expect(result).toBeNull();
          done();
        });
    });

    it('should resolve mod info when configuration matches', (done) => {
      // Config contains: litematica, malilib, minihud, tweakeroo, itemscroller, servux.
      // Match pattern: /^litematica.*?-.+?-.+?-sakura.\d+?.jar$/i
      const matchedFilename = 'litematica-fabric-1.20.1-sakura.2.jar';

      const mockReleases: Partial<GitHubRelease>[] = [
        {
          name: 'litematica-fabric-1.20.1-sakura.2.jar',
          tag_name: 'v1.20.1-sakura.2',
          draft: false,
          prerelease: false,
          created_at: '2026-03-01T00:00:00Z',
          published_at: '2026-03-01T00:00:00Z',
          body: 'Released sakura version',
          assets: [
            {
              name: 'litematica-fabric-1.20.1-sakura.2.jar',
              size: 2048,
              download_count: 150,
              browser_download_url:
                'https://github.com/sakura-ryoko/litematica/releases/download/v1.20.1-sakura.2/litematica-fabric-1.20.1-sakura.2.jar'
            } as any
          ]
        }
      ];

      const mockModrinthProject = {
        id: 'bEpr0Arc',
        slug: 'litematica',
        title: 'Litematica',
        project_type: ProjectType.Mod,
        downloads: 5000,
        published: new Date().toISOString(),
        updated: new Date().toISOString(),
        approved: new Date().toISOString(),
        status: Status.Approved,
        categories: ['optimization'],
        loaders: [Loader.fabric]
      };

      mockModrinth.getProject.and.returnValue(of(mockModrinthProject as any));
      mockModrinth.isAnnotatedError.and.returnValue(false);

      service
        .getModInfoForFile(
          matchedFilename,
          Loader.fabric,
          '1.20.1',
          mockModrinth
        )
        .subscribe((result) => {
          expect(result).not.toBeNull();
          expect(result?.project.title).toBe('Litematica');
          expect(result?.config.owner).toBe('sakura-ryoko');
          expect(result?.versions.length).toBe(1);
          expect(result?.versions[0].version_number).toBe('v1.20.1-sakura.2');
          done();
        });

      // Flushes the GitHub releases fetch
      const req = httpMock.expectOne(
        'https://api.github.com/repos/sakura-ryoko/litematica/releases'
      );
      req.flush(mockReleases as GitHubRelease[]);
    });
  });
});
