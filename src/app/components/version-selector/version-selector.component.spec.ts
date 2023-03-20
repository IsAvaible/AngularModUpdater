import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VersionSelectorComponent } from './version-selector.component';

describe('VersionSelectorComponent', () => {
  let component: VersionSelectorComponent;
  let fixture: ComponentFixture<VersionSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VersionSelectorComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VersionSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
