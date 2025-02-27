import {TestBed} from '@angular/core/testing';

import {PhysicalItemInfoService} from './physical-item-info.service';

describe('ParseReportService', () => {
    let service: PhysicalItemInfoService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(PhysicalItemInfoService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
