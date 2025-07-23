import {Injectable} from '@angular/core';
import {CloudAppRestService} from "@exlibris/exl-cloudapp-angular-lib";
import {BehaviorSubject, forkJoin, Observable, of} from "rxjs";
import {PhysicalItem} from "../fileParsing/physical-item-info.service";
import {catchError, map, retry, tap} from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})
export class BackupItemExportService {

    total = 0
    complete = 0

    constructor(private restService: CloudAppRestService) {
    }

    public pullItemData(barcodes: string[]): Observable<PhysicalItem[]> {
        this.total = barcodes.length
        const itemRequests = barcodes.map(barcode => {
            return this.getItemInfo(barcode).pipe(tap(_ => this.complete++))
        })

        return forkJoin(itemRequests)
    }

    private getItemInfo(barcode: string): Observable<PhysicalItem> {
        return this.restService.call(`/items?item_barcode=${barcode}`).pipe(map(result => {
            return this.extractItemDataFromAPIResponse(barcode, result)
        }), catchError(err => {
            if (err.status === 404 || err.status === 400) {
                return of({
                    barcode,
                    existsInAlma: false,
                    source: 'api',
                    title: null,
                    description: null,
                    mmsId: null,
                    holdingId: null,
                    pid: null,
                    callNumber: null,
                    library: null,
                    location: null,
                    policyType: null,
                    itemMaterialType: null,
                    status: null,
                    processType: null,
                    lastModifiedDate: null,
                    lastLoanDate: null,
                    inTempLocation: null,
                    hasTempLocation: null,
                    requested: null
                })
            } else {
                throw err
            }
        }))
    }

    private getActiveValue(inTempLocation: boolean, permanentValue: string | null, tempValue: string | null): string {
        if (!inTempLocation) return permanentValue
        if (tempValue) return tempValue
        return permanentValue
    };

    public extractItemDataFromAPIResponse(barcode: string, response: object): PhysicalItem {
        // Modified for type-safety with help from Claude 3.7 Sonnet
        const inTempLocation = Boolean(response['holding_data']['in_temp_location']);

        return {
            barcode,
            existsInAlma: true,
            source: 'api',
            title: response['bib_data']['title'] ?? null,
            description: response['item_data']['description'] ?? null,
            mmsId: response['bib_data']['mms_id'] ?? null,
            holdingId: response['holding_data']['holding_id'] ?? null,
            pid: response['item_data']['pid'] ?? null,
            callNumber: response['holding_data']['call_number'] ?? null,
            library: this.getActiveValue(inTempLocation, response['item_data']['library']?.['value'] ?? null, response['holding_data']['temp_library']?.['value'] ?? null),
            libraryName: this.getActiveValue(inTempLocation, response['item_data']['library']?.['desc'] ?? null, response['holding_data']['temp_library']?.['desc'] ?? null),
            location: this.getActiveValue(inTempLocation, response['item_data']['location']?.['value'] ?? null, response['holding_data']['temp_location']?.['value'] ?? null),
            locationName: this.getActiveValue(inTempLocation, response['item_data']['location']?.['desc'] ?? null, response['holding_data']['temp_location']?.['desc'] ?? null),
            policyType: this.getActiveValue(inTempLocation, response['item_data']['policy']?.['value'] ?? null, response['holding_data']['temp_policy']?.['value'] ?? null),
            policyTypeName: this.getActiveValue(inTempLocation, response['item_data']['policy']?.['desc'] ?? null, response['holding_data']['temp_policy']?.['desc'] ?? null),
            itemMaterialType: response['item_data']['physical_material_type']?.['value'] ?? null,
            itemMaterialTypeName: response['item_data']['physical_material_type']?.['desc'] ?? null,
            status: response['item_data']['base_status']['desc'],
            processType: response['item_data']['process_type']?.['value'] ?? null,
            lastModifiedDate: response['item_data']['modification_date'] ?? null,
            lastLoanDate: null,
            inTempLocation: inTempLocation,
            hasTempLocation: null,
            requested: response['item_data']['requested'] ?? false,
        }
    }

    public reset() {
        this.complete = 0
        this.total = 0
    }
}
