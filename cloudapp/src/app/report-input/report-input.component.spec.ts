import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportInputComponent } from './report-input.component';

describe('ReportInputComponent', () => {
  let component: ReportInputComponent;
  let fixture: ComponentFixture<ReportInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ReportInputComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ReportInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
