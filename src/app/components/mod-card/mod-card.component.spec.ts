import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModCardComponent } from './mod-card.component';

describe('ModCardComponent', () => {
  let component: ModCardComponent;
  let fixture: ComponentFixture<ModCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ModCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
