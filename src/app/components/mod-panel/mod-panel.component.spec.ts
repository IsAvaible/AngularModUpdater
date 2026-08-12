import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModPanelComponent } from './mod-panel.component';
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
    spyOn(modrinthService, 'getProject').and.returnValue(
      of(mockProjectData)
    );
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
});

