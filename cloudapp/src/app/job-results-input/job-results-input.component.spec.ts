import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobResultsInputComponent } from './job-results-input.component';

describe('ReportInputComponent', () => {
  let component: JobResultsInputComponent;
  let fixture: ComponentFixture<JobResultsInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JobResultsInputComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JobResultsInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
