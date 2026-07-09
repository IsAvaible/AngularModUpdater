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
});
