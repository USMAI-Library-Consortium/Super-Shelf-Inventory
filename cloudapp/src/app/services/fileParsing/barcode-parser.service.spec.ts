import {TestBed} from '@angular/core/testing';
import * as XLSX from 'xlsx';

import {BarcodeParserService} from './barcode-parser.service';

describe('BarcodeParserService', () => {
    let service: BarcodeParserService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(BarcodeParserService);
    });

    const generateTestExcel = () => {
        const barcodes = [
            {"Barcode": "10000000001"},
            {"Barcode": "10000000002"},
            {"Barcode": "10000000003"},
            {"Barcode": "10000000004"},
            {"Barcode": "10000000005"},
            {"Barcode": "10000000006"},
            {"Barcode": "10000000007"},
            {"Barcode": "10000000008"},
            {"Barcode": "10000000009"},
            {"Barcode": "10000000010"},
            {"Barcode": "10000000011"},
            {"Barcode": "10000000012"},
            {"Barcode": "10000000013"},
            {"Barcode": "10000000014"},
            {"Barcode": "10000000015"},
            {"Barcode": "10000000016"},
            {"Barcode": "10000000017"},
            {"Barcode": "10000000018"},
            {"Barcode": "10000000019"},
            {"Barcode": "10000000020"},
            {"Barcode": "10000000021"},
            {"Barcode": "10000000022"},
            {"Barcode": "10000000023"},
            {"Barcode": "10000000024"},
            {"Barcode": "10000000025"},
            {"Barcode": "10000000026"},
            {"Barcode": "10000000027"},
            {"Barcode": "10000000028"},
            {"Barcode": "10000000029"},
            {"Barcode": "10000000030"},
            {"Barcode": "10000000031"},
            {"Barcode": "10000000032"},
            {"Barcode": "10000000033"},
            {"Barcode": "10000000034"},
            {"Barcode": "10000000035"},
            {"Barcode": "10000000036"},
            {"Barcode": "10000000037"},
            {"Barcode": "10000000038"},
            {"Barcode": "10000000039"},
            {"Barcode": "10000000040"},
            {"Barcode": "10000000041"},
            {"Barcode": "10000000042"},
            {"Barcode": "10000000043"},
            {"Barcode": "10000000044"},
            {"Barcode": "10000000045"},
            {"Barcode": "10000000046"},
            {"Barcode": "10000000047"},
            {"Barcode": "10000000048"},
            {"Barcode": "10000000049"},
            {"Barcode": "10000000050"},
            {"Barcode": "10000000051"},
            {"Barcode": "10000000052"},
            {"Barcode": "10000000053"},
            {"Barcode": "10000000054"},
            {"Barcode": "10000000055"},
            {"Barcode": "10000000056"},
            {"Barcode": "10000000057"},
            {"Barcode": "10000000058"},
            {"Barcode": "10000000059"},
            {"Barcode": "10000000060"},
            {"Barcode": "10000000061"},
            {"Barcode": "10000000062"},
            {"Barcode": "10000000063"},
            {"Barcode": "10000000064"},
            {"Barcode": "10000000065"},
            {"Barcode": "10000000066"},
            {"Barcode": "10000000067"},
            {"Barcode": "10000000068"},
            {"Barcode": "10000000069"},
            {"Barcode": "10000000070"},
            {"Barcode": "10000000071"},
            {"Barcode": "10000000072"},
            {"Barcode": "10000000073"},
            {"Barcode": "10000000074"},
            {"Barcode": "10000000075"},
            {"Barcode": "10000000076"},
            {"Barcode": "10000000077"},
            {"Barcode": "10000000078"},
            {"Barcode": "10000000079"},
            {"Barcode": "10000000080"},
            {"Barcode": "10000000081"},
            {"Barcode": "10000000082"},
            {"Barcode": "10000000083"},
            {"Barcode": "10000000084"},
            {"Barcode": "10000000085"},
            {"Barcode": "10000000086"},
            {"Barcode": "10000000087"},
            {"Barcode": "10000000088"},
            {"Barcode": "10000000089"},
            {"Barcode": "10000000090"},
            {"Barcode": "10000000091"},
            {"Barcode": "10000000092"},
            {"Barcode": "10000000093"}
        ]
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
    it('should parse barcodes in the correct order', (done: DoneFn) => {
        service.parseExcelFile(generateTestExcel()).subscribe(barcodes => {
            for (const [i, barcode] of barcodes.entries()) {
                expect(barcode.toString().includes((i + 1).toString())).toBeTrue()
            }
            done()
        })
    })
});
