import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoTriangleComponent } from './info-triangle.component';

describe('InfoTriangleComponent', () => {
  let component: InfoTriangleComponent;
  let fixture: ComponentFixture<InfoTriangleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InfoTriangleComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(InfoTriangleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
