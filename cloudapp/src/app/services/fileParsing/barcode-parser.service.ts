import {Injectable} from '@angular/core';
import {BehaviorSubject, from, Observable} from "rxjs";
import * as XLSX from "xlsx";
import {AlertService} from "@exlibris/exl-cloudapp-angular-lib";
import {filter, take, tap} from "rxjs/operators";

export interface FileInfo {
    inputFileName: string;
    numberOfRecords: number;
    firstBarcode: string;
}

@Injectable({
    providedIn: 'root'
})
export class BarcodeParserService {
    private barcodes$: BehaviorSubject<string[] | null> = new BehaviorSubject(null);
    private scanDate$: BehaviorSubject<string | null> = new BehaviorSubject(null);
    public fileInfo: FileInfo = null;

    constructor(private alert: AlertService) {
    }

    public getLatestBarcodes(): Observable<string[]> {
        return this.barcodes$.pipe(filter(barcodes => barcodes instanceof Array), take(1))
    }
    public getLatestScanDate(): Observable<string> {
        return this.scanDate$.pipe(filter(scanDate => !!scanDate), take(1))
    }

    public setScanDate(scanDate: string) {
        this.scanDate$.next(scanDate);
    }

    public reset() {
        this.barcodes$.next(null)
        this.scanDate$.next(null)
    }

    public parseExcelFile(excelFile: Blob): Observable<string[]> {
        this.barcodes$.next(null)
        this.scanDate$.next(null)

        return from(
            excelFile.arrayBuffer().then(
                (data) => {
                    const items = new Set<string>();
                    const workbook = XLSX.read(data, {
                        type: "binary",
                    });

                    const firstSheetName = workbook.SheetNames[0];
                    const rows: any[] = XLSX.utils.sheet_to_json(
                        workbook.Sheets[firstSheetName]
                    );
                    rows.forEach((row) => {
                        // MODIFIED USING CLAUDE 3.7 SONNET
                        let barcode: string = null;

                        // Find the first matching key using case-insensitive comparison and handle plurals
                        const barcodeKey = Object.keys(row).find(key =>
                            key.toLowerCase() === "barcode" ||
                            key.toLowerCase() === "barcodes"
                        );

                        if (barcodeKey) {
                            barcode = row[barcodeKey];
                            if (barcode) {
                                items.add(barcode);
                            }
                        } else {
                            this.alert.error(`No barcode column in file; found columns ${Object.keys(row).join(", ")}`);
                            throw Error("Invalid Document.");
                        }
                    });

                    const itemsArray: string[] = Array.from(items)
                    console.log(`${itemsArray} items parsed from excel file.`);
                    return itemsArray;
                },
                (reason) => {
                    this.alert.error("Error in parsing excel file. Ensure it is valid.");
                    throw reason;
                }
            )
        ).pipe(tap(barcodes => this.barcodes$.next(barcodes))) as Observable<string[]>;
    }
}
