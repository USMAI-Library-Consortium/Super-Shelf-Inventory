import {TestBed} from '@angular/core/testing';

import {IndividualItemInfoService} from './individual-item-info.service';
import {initialBarcodes, exportData} from "./export-job-test-data";
import {ExportJobService} from "./export-job.service";
import {PhysicalItem} from "../fileParsing/physical-item-info.service";
import {of} from "rxjs";
import {delay} from "rxjs/operators";

describe('IndividualItemInfoService', () => {
    let service: IndividualItemInfoService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(IndividualItemInfoService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should not reorder barcodes', (done: DoneFn) => {
        let inTempLocation: boolean = false
        spyOn<IndividualItemInfoService, any>(service, "fetchTempLocationInfo").and.callFake((physicalItem: PhysicalItem) => {
            const newItem = {...physicalItem}
            newItem.inTempLocation = inTempLocation
            inTempLocation = !inTempLocation
            return of(newItem).pipe(delay(10))
        })
        const ejs = TestBed.inject(ExportJobService);
        ejs.parseReport(exportData, initialBarcodes).subscribe(items => {
            service.pullTempLocationItemInfo(items).subscribe(itemsWithTempLocations => {
                for (const [i, item] of itemsWithTempLocations.entries()) {
                    expect(`${item.barcode}`).toEqual(initialBarcodes[i]);
                }
                done()
            })
        })
    })
});
