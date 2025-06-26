import {TestBed} from '@angular/core/testing';
import * as XLSX from 'xlsx';

import {BarcodeParserService} from './barcode-parser.service';
import {initialBarcodes, testSequentialBarcodes} from "../apis/export-job-test-data";

describe('BarcodeParserService', () => {
    let service: BarcodeParserService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(BarcodeParserService);
    });

    const generateTestExcel = (barcodes = testSequentialBarcodes) => {
        const worksheet = XLSX.utils.json_to_sheet(barcodes)
        const workbook: XLSX.WorkBook = {
            Sheets: {'Sheet1': worksheet},
            SheetNames: ['Sheet1'],
        };
        const arrayBuffer = XLSX.write(workbook, {bookType: 'xlsx', type: 'array'});
        return new Blob([arrayBuffer], {type: 'application/octet-stream'});
    }

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('Should parse correct number of barcodes', (done: DoneFn) => {
        service.parseExcelFile(generateTestExcel()).subscribe(barcodes => {
            expect(barcodes.length).toBe(93)
            done()
        })
    })
    it('Should parse correct number of barcodes 2', (done: DoneFn) => {
        console.log(initialBarcodes.length)
        service.parseExcelFile(generateTestExcel(initialBarcodes.map((barcode: string) => {
            return {"Barcode": `${barcode}`}
        }))).subscribe(barcodes => {
            expect(barcodes.length).toBe(281) // Input file contains a duplicate
            done()
        })
    })
    it('should parse barcodes in the correct order', (done: DoneFn) => {
        service.parseExcelFile(generateTestExcel()).subscribe(barcodes => {
            for (const [i, barcode] of barcodes.entries()) {
                expect(barcode.toString().includes((i + 1).toString())).toBeTrue()
            }
            done()
        })
    })
    it('should parse barcodes in the correct order 2', (done: DoneFn) => {
        service.parseExcelFile(generateTestExcel(initialBarcodes.map((barcode: string) => {
            return {"Barcode": `${barcode}`}
        }))).subscribe(barcodes => {
            expect(barcodes[0]).toBe("20013718000")
            expect(barcodes[106]).toBe("20013378607")
            expect(barcodes[280]).toBe("20013820855")
            done()
        })
    })
});
