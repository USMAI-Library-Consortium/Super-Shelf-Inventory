import { TestBed } from '@angular/core/testing';

import { ExportJobService } from './export-job.service';

describe('ExportJobService', () => {
  let service: ExportJobService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportJobService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
