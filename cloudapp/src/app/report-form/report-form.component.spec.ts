import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportForm } from './report-form.component';

describe('InputformComponent', () => {
  let component: ReportForm;
  let fixture: ComponentFixture<ReportForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ReportForm ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ReportForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // it('should create', () => {
  //   expect(component).toBeTruthy();
  // });
});
