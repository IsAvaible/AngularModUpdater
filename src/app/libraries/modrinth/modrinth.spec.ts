import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, HttpHeaders } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ModrinthService } from '../../services/modrinth.service';
import { ModrinthProject, ModrinthVersion, ProjectType, Status } from './types.modrinth';
import { Loader } from '../../services/loader.service';

describe('ModrinthService (Modrinth API)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ModrinthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    const service = TestBed.inject(ModrinthService);
    expect(service).toBeTruthy();
  });

  describe('getProjects', () => {
    it('should query multiple projects by ID', (done) => {
      const service = TestBed.inject(ModrinthService);
      const mockProjects: Partial<ModrinthProject>[] = [
        { id: 'proj1', slug: 'slug1', title: 'Proj 1', published: new Date(), updated: new Date(), approved: new Date(), status: Status.Approved, downloads: 100, project_type: ProjectType.Mod },
        { id: 'proj2', slug: 'slug2', title: 'Proj 2', published: new Date(), updated: new Date(), approved: new Date(), status: Status.Approved, downloads: 200, project_type: ProjectType.Mod }
      ];

      service.getProjects(['proj1', 'proj2']).subscribe((result) => {
        expect(result['proj1']).toBeDefined();
        expect(result['proj2']).toBeDefined();
        expect((result['proj1'] as ModrinthProject).title).toBe('Proj 1');
        expect((result['proj2'] as ModrinthProject).title).toBe('Proj 2');
        done();
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/projects') && r.params.has('ids'));
      expect(req.request.method).toBe('GET');
      expect(JSON.parse(req.request.params.get('ids')!)).toEqual(['proj1', 'proj2']);
      req.flush(mockProjects as ModrinthProject[]);
    });
  });

  describe('Buffering / Coalescing of project requests', () => {
    it('should coalesce multiple getProject requests into one batch request within configured delay', fakeAsync(() => {
      const service = TestBed.inject(ModrinthService);
      let res1: any, res2: any;
      service.getProject('proj1').subscribe(val => res1 = val);
      service.getProject('proj2').subscribe(val => res2 = val);

      // Advance time by the service's configured delay to resolve the buffer
      tick((service as any).bufferDelay);

      const mockProjects: Partial<ModrinthProject>[] = [
        { id: 'proj1', slug: 'slug1', title: 'Proj 1', published: new Date(), updated: new Date(), approved: new Date(), status: Status.Approved, downloads: 100, project_type: ProjectType.Mod },
        { id: 'proj2', slug: 'slug2', title: 'Proj 2', published: new Date(), updated: new Date(), approved: new Date(), status: Status.Approved, downloads: 200, project_type: ProjectType.Mod }
      ];

      const req = httpMock.expectOne((r) => r.url.endsWith('/projects') && r.params.has('ids'));
      req.flush(mockProjects as ModrinthProject[]);

      expect(res1.title).toBe('Proj 1');
      expect(res2.title).toBe('Proj 2');
    }));
  });

  describe('getVersionsFromId', () => {
    it('should request version list filtered by game version and loader', (done) => {
      const service = TestBed.inject(ModrinthService);
      const mockVersions: Partial<ModrinthVersion>[] = [
        { id: 'v1', project_id: 'proj1', name: 'v1.0', version_number: '1.0.0', date_published: new Date(), files: [], loaders: [Loader.fabric] }
      ];

      service.getVersionsFromId('proj1', '1.20.1', ['fabric']).subscribe((versions) => {
        expect(Array.isArray(versions)).toBeTrue();
        expect((versions as ModrinthVersion[])[0].id).toBe('v1');
        done();
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/project/proj1/version'));
      expect(req.request.method).toBe('GET');
      expect(JSON.parse(req.request.params.get('game_versions')!)).toEqual(['1.20.1']);
      expect(JSON.parse(req.request.params.get('loaders')!)).toEqual(['fabric']);
      req.flush(mockVersions as ModrinthVersion[]);
    });
  });

  describe('Buffering / Coalescing of version requests by hash', () => {
    it('should coalesce multiple getVersionFromHash requests into a single POST query within configured delay', fakeAsync(() => {
      const service = TestBed.inject(ModrinthService);
      let res1: any, res2: any;
      service.getVersionFromHash('hash1').subscribe(val => res1 = val);
      service.getVersionFromHash('hash2').subscribe(val => res2 = val);

      tick((service as any).bufferDelay);

      const mockVersionsResponse = {
        hash1: { id: 'v1', name: 'Version 1', date_published: new Date().toISOString() },
        hash2: { id: 'v2', name: 'Version 2', date_published: new Date().toISOString() }
      };

      const req = httpMock.expectOne((r) => r.url.endsWith('/version_files'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body.hashes).toEqual(['hash1', 'hash2']);
      req.flush(mockVersionsResponse);

      expect(res1.name).toBe('Version 1');
      expect(res2.name).toBe('Version 2');
    }));
  });

  describe('Rate Limiting tracking', () => {
    it('should update service rate limiting details when headers are present', (done) => {
      const service = TestBed.inject(ModrinthService);
      service.getProjects(['proj1']).subscribe(() => {
        expect(service.rateLimitLimit).toBe(300);
        expect(service.rateLimitRemaining).toBe(295);
        done();
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/projects'));
      const headers = new HttpHeaders()
        .set('x-ratelimit-limit', '300')
        .set('x-ratelimit-remaining', '295')
        .set('x-ratelimit-reset', '10');

      req.flush([], { headers });
    });
  });

  describe('Error Retry Strategy', () => {
    it('should retry up to 3 times on 500 server error', fakeAsync(() => {
      const service = TestBed.inject(ModrinthService);
      let errorOccurred = false;
      service.getProjects(['proj1']).subscribe({
        next: (val: any) => {
          if (val && (val.error || (val.proj1 && val.proj1.error))) {
            errorOccurred = true;
          }
        }
      });

      // Request 1 fails (500)
      let req = httpMock.expectOne((r) => r.url.endsWith('/projects'));
      req.flush('Error', { status: 500, statusText: 'Internal Server Error' });
      tick(1500); // Backoff delay 1 (~1000-1200ms)

      // Request 2 fails (500)
      req = httpMock.expectOne((r) => r.url.endsWith('/projects'));
      req.flush('Error', { status: 500, statusText: 'Internal Server Error' });
      tick(2500); // Backoff delay 2 (~2000-2200ms)

      // Request 3 fails (500)
      req = httpMock.expectOne((r) => r.url.endsWith('/projects'));
      req.flush('Error', { status: 500, statusText: 'Internal Server Error' });
      tick(4500); // Backoff delay 3 (~4000-4200ms)

      // Request 4 (final retry) fails
      req = httpMock.expectOne((r) => r.url.endsWith('/projects'));
      req.flush('Error', { status: 500, statusText: 'Internal Server Error' });

      tick(); // Let microtasks run
      expect(errorOccurred).toBeTrue();
    }));
  });
});
