import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VersionsService, MinecraftVersion } from './versions.service';

describe('VersionsService', () => {
  let service: VersionsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.removeItem('mc-version');

    TestBed.configureTestingModule({
      providers: [
        VersionsService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(VersionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    // Flush the constructor request
    const req = httpMock.expectOne('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    req.flush({ latest: { release: '1.20.1', snapshot: '' }, versions: [] });
  });

  it('should initially set default/loading versions', (done) => {
    service.versions.subscribe((versions) => {
      if (versions.length > 0 && versions[1]?.version === 'Loading...') {
        expect(versions[0].version).toBe('1.20.1');
        expect(versions[0].selected).toBeTrue();
        done();
      }
    });

    // Mock the pending HTTP request to let it complete later
    const req = httpMock.expectOne('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    req.flush({
      latest: { release: '1.20.1', snapshot: '1.20.2-pre1' },
      versions: []
    });
  });

  it('should load versions from Mojang API and update list', (done) => {
    const mockResponse = {
      latest: { release: '1.20.1', snapshot: '1.20.2-pre1' },
      versions: [
        { id: '1.20.1', type: 'release', url: '', time: '', releaseTime: '' },
        { id: '1.20', type: 'release', url: '', time: '', releaseTime: '' },
        { id: '1.19.4', type: 'release', url: '', time: '', releaseTime: '' }
      ]
    };

    // The subscription will first receive the initial default state, then the updated list
    let emissionCount = 0;
    service.versions.subscribe((versions) => {
      emissionCount++;
      if (emissionCount === 2) {
        expect(versions.length).toBe(3);
        expect(versions.find(v => v.version === '1.20.1')?.selected).toBeTrue();
        expect(versions.find(v => v.version === '1.20')?.selected).toBeFalse();
        done();
      }
    });

    const req = httpMock.expectOne('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    req.flush(mockResponse);
  });

  it('should update selected version in localStorage when setVersions is called', (done) => {
    const newVersions: MinecraftVersion[] = [
      { version: '1.20.1', selected: false, type: 'release' },
      { version: '1.20.2', selected: true, type: 'release' }
    ];

    // Flush the constructor request first
    const req = httpMock.expectOne('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    req.flush({ latest: { release: '1.20.1', snapshot: '' }, versions: [] });

    service.setVersions(newVersions);

    expect(localStorage.getItem('mc-version')).toBe(JSON.stringify('1.20.2'));

    service.versions.subscribe((versions) => {
      expect(versions.find(v => v.version === '1.20.2')?.selected).toBeTrue();
      done();
    });
  });
});
