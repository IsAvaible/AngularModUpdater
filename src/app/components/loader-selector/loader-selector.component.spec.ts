import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoaderSelectorComponent } from './loader-selector.component';
import { LoaderService } from '../../services/loader.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('LoaderSelectorComponent', () => {
  let component: LoaderSelectorComponent;
  let fixture: ComponentFixture<LoaderSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoaderSelectorComponent],
      providers: [LoaderService],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(LoaderSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
