import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CurseforgeService } from '../../services/curseforge.service';
import { CurseforgeMod, CurseforgeFile, FileReleaseType } from './types.curseforge';

describe('CurseforgeService (Curseforge API)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CurseforgeService,
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
    const service = TestBed.inject(CurseforgeService);
    expect(service).toBeTruthy();
  });

  describe('getMods', () => {
    it('should query multiple mods by ID using POST', (done) => {
      const service = TestBed.inject(CurseforgeService);
      const mockMods: Partial<CurseforgeMod>[] = [
        { id: 101, name: 'Mod 101', slug: 'mod-101', dateCreated: new Date(), dateModified: new Date(), dateReleased: new Date() },
        { id: 102, name: 'Mod 102', slug: 'mod-102', dateCreated: new Date(), dateModified: new Date(), dateReleased: new Date() }
      ];

      service.getMods([101, 102]).subscribe((result) => {
        expect(result[101]).toBeDefined();
        expect(result[102]).toBeDefined();
        expect((result[101] as CurseforgeMod).name).toBe('Mod 101');
        expect((result[102] as CurseforgeMod).name).toBe('Mod 102');
        done();
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/v1/mods'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ modIds: [101, 102] });
      req.flush({ data: mockMods as CurseforgeMod[] });
    });
  });

  describe('Buffering / Coalescing of Mod retrieval', () => {
    it('should coalesce multiple getMod requests into a single batch query within configured delay', fakeAsync(() => {
      const service = TestBed.inject(CurseforgeService);
      let res1: any, res2: any;
      service.getMod(101).subscribe(val => res1 = val);
      service.getMod(102).subscribe(val => res2 = val);

      tick(service.bufferDelay);

      const mockMods: Partial<CurseforgeMod>[] = [
        { id: 101, name: 'Mod 101', slug: 'mod-101', dateCreated: new Date(), dateModified: new Date(), dateReleased: new Date() },
        { id: 102, name: 'Mod 102', slug: 'mod-102', dateCreated: new Date(), dateModified: new Date(), dateReleased: new Date() }
      ];

      const req = httpMock.expectOne((r) => r.url.endsWith('/v1/mods'));
      req.flush({ data: mockMods as CurseforgeMod[] });

      expect(res1.name).toBe('Mod 101');
      expect(res2.name).toBe('Mod 102');
    }));
  });

  describe('Buffering / Coalescing of File By ID retrieval', () => {
    it('should coalesce multiple getFileFromIndex requests into a single batch query within configured delay', fakeAsync(() => {
      const service = TestBed.inject(CurseforgeService);
      let file1: any, file2: any;
      service.getFileFromIndex(5001).subscribe(val => file1 = val);
      service.getFileFromIndex(5002).subscribe(val => file2 = val);

      tick(service.bufferDelay);

      const mockFiles: Partial<CurseforgeFile>[] = [
        { id: 5001, displayName: 'File 5001', fileName: 'f1.jar', fileDate: new Date(), releaseType: FileReleaseType.Release },
        { id: 5002, displayName: 'File 5002', fileName: 'f2.jar', fileDate: new Date(), releaseType: FileReleaseType.Release }
      ];

      const req = httpMock.expectOne((r) => r.url.endsWith('/v1/mods/files'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ fileIds: [5001, 5002] });
      req.flush({ data: mockFiles as CurseforgeFile[] });

      expect(file1.displayName).toBe('File 5001');
      expect(file2.displayName).toBe('File 5002');
    }));
  });

  describe('getFileFromBuffer (Fingerprinting)', () => {
    it('should compute fingerprint, buffer request, and query the fingerprints API', fakeAsync(() => {
      const service = TestBed.inject(CurseforgeService);
      // Create a dummy 10-byte buffer.
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < 10; i++) {
        view[i] = i + 1; // values 1..10
      }

      let matchedFile: any;
      service.getFileFromBuffer(buffer).subscribe(val => matchedFile = val);

      tick(service.bufferDelay);

      const req = httpMock.expectOne((r) => r.url.endsWith('/v1/fingerprints'));
      expect(req.request.method).toBe('POST');
      const requestedFingerprint = req.request.body.fingerprints[0];
      expect(requestedFingerprint).toBeDefined();

      const mockFile: Partial<CurseforgeFile> = {
        id: 9999,
        displayName: 'Matched File',
        fileName: 'matched.jar',
        fileDate: new Date(),
        fileFingerprint: requestedFingerprint,
        releaseType: FileReleaseType.Release
      };

      req.flush({
        data: {
          exactMatches: [
            { id: 9999, file: mockFile as CurseforgeFile }
          ]
        }
      });

      expect(matchedFile.displayName).toBe('Matched File');
    }));
  });

  describe('searchMods', () => {
    it('should compile search criteria into query params', (done) => {
      const service = TestBed.inject(CurseforgeService);
      service.searchMods({ classId: 6, searchFilter: 'jei' }).subscribe((result) => {
        expect(result).toBeDefined();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.startsWith(service.curseforgeAPIUrl + 'mods/search') &&
        r.url.includes('gameId=432') &&
        r.url.includes('classId=6') &&
        r.url.includes('searchFilter=jei')
      );
      expect(req.request.method).toBe('GET');
      req.flush({ data: { index: 0, count: 0, totalCount: 0, data: [] } });
    });
  });

  describe('getModFileChangelog', () => {
    it('should query the changelog URL', (done) => {
      const service = TestBed.inject(CurseforgeService);
      service.getModFileChangelog(12345, 67890).subscribe((changelog) => {
        expect(changelog).toBe('<p>Changelog body</p>');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.endsWith('/v1/mods/12345/files/67890/changelog')
      );
      expect(req.request.method).toBe('GET');
      req.flush({ data: '<p>Changelog body</p>' });
    });
  });
});
