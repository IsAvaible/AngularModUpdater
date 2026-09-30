import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModPanelComponent, VersionStatus } from './mod-panel.component';
import { FilesService } from '../../services/files.service';
import { VersionsService } from '../../services/versions.service';
import { LoaderService } from '../../services/loader.service';
import { CurseforgeSupportService } from '../../services/curseforgeSupport.service';
import { ModrinthService } from '../../services/modrinth.service';
import { CurseforgeService } from '../../services/curseforge.service';
import { GitHubService } from '../../services/github.service';
import { InteroperabilityService } from '../../services/interoperability.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

describe('ModPanelComponent', () => {
  let component: ModPanelComponent;
  let fixture: ComponentFixture<ModPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModPanelComponent],
      providers: [
        FilesService,
        VersionsService,
        LoaderService,
        CurseforgeSupportService,
        ModrinthService,
        CurseforgeService,
        GitHubService,
        InteroperabilityService,
        provideHttpClient(),
        provideHttpClientTesting()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ModPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pass empty loaders list for ResourcePacks in tryModrinth', async () => {
    const modrinthService = TestBed.inject(ModrinthService);
    const mockFile = new File(['dummy'], 'resourcepack.zip');
    const mockVersionData: any = { id: 'ver1', project_id: 'proj1' };
    const mockProjectData: any = {
      id: 'proj1',
      slug: 'resourcepack-slug',
      project_type: 'resourcepack',
      loaders: []
    };
    const mockVersionsData: any[] = [
      { id: 'ver2', game_versions: ['1.21.1'], loaders: ['minecraft'] }
    ];

    spyOn(modrinthService, 'getVersionFromHash').and.returnValue(
      of(mockVersionData)
    );
    spyOn(modrinthService, 'getProject').and.returnValue(of(mockProjectData));
    const getVersionsSpy = spyOn(
      modrinthService,
      'getVersionsFromId'
    ).and.returnValue(of(mockVersionsData));

    const mcVersion = { version: '1.21.1', selected: true, supported: true };
    const result = await (component as any).tryModrinth(
      'dummyhash',
      mockFile,
      mcVersion
    );

    expect(result).toBeTrue();
    expect(getVersionsSpy).toHaveBeenCalledWith('proj1', '1.21.1', []);
  });

  describe('annotateVersionStatus', () => {
    it('should mark version as Updated on a Minecraft version bump even if date_published is earlier (YACL scenario)', () => {
      // YACL scenario:
      // Installed: 3.9.7+26.2-fabric (published at 23:11:40)
      // Target: 3.9.7+26.3-fabric for MC 26.3 (published at 23:11:34, 6 seconds earlier!)
      const installedVersion: any = {
        id: 'DoR7RYgi',
        version_number: '3.9.7+26.2-fabric',
        game_versions: ['26.2'],
        date_published: new Date('2026-09-20T23:11:40.291025Z')
      };

      const targetVersions: any[] = [
        {
          id: 's9SjoFu1',
          version_number: '3.9.7+26.3-fabric',
          game_versions: ['26.3'],
          date_published: new Date('2026-09-20T23:11:34.251964Z')
        },
        {
          id: 'older26.3',
          version_number: '3.9.6+26.3-fabric',
          game_versions: ['26.3'],
          date_published: new Date('2026-07-19T12:41:24.596972Z')
        }
      ];

      const annotated = (component as any).annotateVersionStatus(
        installedVersion,
        targetVersions,
        '26.3'
      );

      expect(annotated[0].versionStatus).toBe(VersionStatus.Updated);
      expect(annotated[0].selected).toBeTrue();
      expect(annotated[1].versionStatus).toBe(VersionStatus.Outdated);
    });

    it('should mark exact ID matches as Installed', () => {
      const installedVersion: any = {
        id: 'ver1',
        version_number: '1.0.0',
        game_versions: ['1.20.1'],
        date_published: new Date('2026-01-01')
      };

      const targetVersions: any[] = [
        {
          id: 'ver2',
          version_number: '1.0.1',
          game_versions: ['1.20.1'],
          date_published: new Date('2026-01-02')
        },
        {
          id: 'ver1',
          version_number: '1.0.0',
          game_versions: ['1.20.1'],
          date_published: new Date('2026-01-01')
        }
      ];

      const annotated = (component as any).annotateVersionStatus(
        installedVersion,
        targetVersions,
        '1.20.1'
      );

      expect(annotated[0].versionStatus).toBe(VersionStatus.Updated);
      expect(annotated[1].versionStatus).toBe(VersionStatus.Installed);
    });

    it('should compare mod versions by semantic numbers on the same Minecraft version', () => {
      const installedVersion: any = {
        id: 'installedId',
        version_number: 'mc26.3-0.9.3-fabric',
        game_versions: ['26.3'],
        date_published: new Date('2026-05-01')
      };

      const targetVersions: any[] = [
        {
          id: 'newerMod',
          version_number: 'mc26.3-0.9.4-fabric',
          game_versions: ['26.3'],
          date_published: new Date('2026-04-01') // Earlier date, but higher mod version
        },
        {
          id: 'olderMod',
          version_number: 'mc26.3-0.9.2-fabric',
          game_versions: ['26.3'],
          date_published: new Date('2026-06-01') // Later date, but lower mod version
        }
      ];

      const annotated = (component as any).annotateVersionStatus(
        installedVersion,
        targetVersions,
        '26.3'
      );

      expect(annotated[0].versionStatus).toBe(VersionStatus.Updated);
      expect(annotated[1].versionStatus).toBe(VersionStatus.Outdated);
    });

    it('should mark versions as Outdated on a Minecraft version downgrade', () => {
      const installedVersion: any = {
        id: 'ver1',
        version_number: '1.0.0',
        game_versions: ['1.21.1'],
        date_published: new Date('2026-01-01')
      };

      const targetVersions: any[] = [
        {
          id: 'ver0',
          version_number: '1.0.0',
          game_versions: ['1.20.1'],
          date_published: new Date('2025-01-01')
        }
      ];

      const annotated = (component as any).annotateVersionStatus(
        installedVersion,
        targetVersions,
        '1.20.1'
      );

      expect(annotated[0].versionStatus).toBe(VersionStatus.Outdated);
    });

    it('should handle null installedVersion by setting Unspecified', () => {
      const targetVersions: any[] = [
        {
          id: 'ver1',
          version_number: '1.0.0',
          game_versions: ['1.20.1'],
          date_published: new Date('2026-01-01')
        }
      ];

      const annotated = (component as any).annotateVersionStatus(
        null,
        targetVersions,
        '1.20.1'
      );

      expect(annotated[0].versionStatus).toBe(VersionStatus.Unspecified);
      expect(annotated[0].selected).toBeTrue();
    });
  });
});
