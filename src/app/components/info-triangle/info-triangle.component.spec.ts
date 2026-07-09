import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoTriangleComponent } from './info-triangle.component';
import { ModrinthService } from '../../services/modrinth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('InfoTriangleComponent', () => {
  let component: InfoTriangleComponent;
  let fixture: ComponentFixture<InfoTriangleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InfoTriangleComponent],
      providers: [
        ModrinthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(InfoTriangleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
