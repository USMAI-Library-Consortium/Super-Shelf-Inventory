import {TestBed} from '@angular/core/testing';

import {ReportService} from './report.service';
import {ExportJobService} from "../apis/export-job.service";
import {exportData, initialBarcodes} from "../apis/export-job-test-data";


describe('ReportService', () => {
    let service: ReportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ReportService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should leave items in the correct order', (done: DoneFn) => {
        const ejs = TestBed.inject(ExportJobService);
        ejs.parseReport(exportData, initialBarcodes).subscribe(items => {
            const reportData = service.generateReport("LC", "EF", ["emain"], ["BOOK"], ["1"], "no", false, "actualOrder", false, null, Date.now().toString(), items)
            for (const [i, item] of reportData.unsortedItems.entries()) {
                expect(item.barcode).toEqual(initialBarcodes[i]);
            }
            expect(reportData.unsortedItems[(reportData.unsortedItems.length - 1)].barcode).toBe("20013820855")
            done()
        })
    })
});
