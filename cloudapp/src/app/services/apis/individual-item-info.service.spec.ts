import { TestBed } from '@angular/core/testing';

import { IndividualItemInfoService } from './individual-item-info.service';

describe('IndividualItemInfoService', () => {
  let service: IndividualItemInfoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndividualItemInfoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
