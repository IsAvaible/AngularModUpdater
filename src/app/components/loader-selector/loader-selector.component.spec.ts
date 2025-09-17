import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoaderSelectorComponent } from './loader-selector.component';

describe('LoaderSelectorComponent', () => {
  let component: LoaderSelectorComponent;
  let fixture: ComponentFixture<LoaderSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoaderSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoaderSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
