import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportLoadingComponent } from './report-loading.component';

describe('ReportLoadingComponent', () => {
  let component: ReportLoadingComponent;
  let fixture: ComponentFixture<ReportLoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ReportLoadingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ReportLoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
