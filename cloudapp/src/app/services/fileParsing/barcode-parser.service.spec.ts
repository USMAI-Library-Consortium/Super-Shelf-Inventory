import { TestBed } from '@angular/core/testing';

import { BarcodeParserService } from './barcode-parser.service';

describe('BarcodeParserService', () => {
  let service: BarcodeParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BarcodeParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
