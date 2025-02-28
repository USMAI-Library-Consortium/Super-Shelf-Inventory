import {Injectable} from '@angular/core';
import * as Papa from 'papaparse'
import {BehaviorSubject, Observable} from 'rxjs';
import {filter, take} from "rxjs/operators";

export interface PhysicalItem {
    barcode: string,
    existsInAlma: boolean,
    source: string, // Whether the data was pulled from job 'job' or item api 'api'

    mmsId: string | null,
    holdingId: string | null,
    pid: string | null,

    title: string | null,
    callNumber: string | null,
    description: string | null,
    library: string | null,
    libraryName?: string,
    location: string | null,
    locationName?: string,
    itemMaterialType: string | null,
    itemMaterialTypeName?: string,
    policyType: string | null,
    policyTypeName?: string,
    status: string | null,
    processType: string | null,
    lastModifiedDate: string | null,
    hasTempLocation: boolean,
    inTempLocation: boolean | null,
    requested: boolean | null
}

@Injectable({
    providedIn: 'root'
})
export class PhysicalItemInfoService {
    private physicalItems$: BehaviorSubject<PhysicalItem[] | null> = new BehaviorSubject(null)

    constructor() {
    }

    public getLatestPhysicalItems() {
        return this.physicalItems$.pipe(filter(physicalItems => {
            return physicalItems instanceof Array
        }), take(1))
    }

    public setLatestPhysicalItems(physicalItems: PhysicalItem[]) {
        this.physicalItems$.next(physicalItems)
    }

    public reset() {
        this.physicalItems$.next(null)
    }
}
