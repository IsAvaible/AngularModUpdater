import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateAgoComponent } from './date-ago.component';

describe('DateAgoComponent', () => {
  let component: DateAgoComponent;
  let fixture: ComponentFixture<DateAgoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DateAgoComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DateAgoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
