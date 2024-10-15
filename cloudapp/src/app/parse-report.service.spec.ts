import { TestBed } from '@angular/core/testing';

import { ParseReportService } from './parse-report.service';

describe('ParseReportService', () => {
  let service: ParseReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ParseReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
