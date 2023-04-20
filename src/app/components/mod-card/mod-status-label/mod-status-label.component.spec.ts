import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModStatusLabelComponent } from './mod-status-label.component';

describe('ModStatusLabelComponent', () => {
  let component: ModStatusLabelComponent;
  let fixture: ComponentFixture<ModStatusLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModStatusLabelComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModStatusLabelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
