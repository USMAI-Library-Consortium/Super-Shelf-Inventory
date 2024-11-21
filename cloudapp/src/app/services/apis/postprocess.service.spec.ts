import { TestBed } from '@angular/core/testing';

import { PostprocessService } from './postprocess.service';

describe('PostprocessService', () => {
  let service: PostprocessService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PostprocessService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
