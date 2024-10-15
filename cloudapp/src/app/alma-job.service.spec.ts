import { TestBed } from '@angular/core/testing';

import { AlmaJobService } from './alma-job.service';

describe('AlmaJobService', () => {
  let service: AlmaJobService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AlmaJobService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
