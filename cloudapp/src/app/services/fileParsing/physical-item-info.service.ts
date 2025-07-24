import {Injectable} from '@angular/core';

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
    lastModifiedDate: number | null,
    lastLoanDate: number | null | -1,
    hasTempLocation: boolean,
    inTempLocation: boolean | null,
    requested: boolean | null
}

@Injectable({
    providedIn: 'root'
})
export class PhysicalItemInfoService {
    public physicalItems: PhysicalItem[] = null

    constructor() {
    }

    public reset() {
        this.physicalItems = null
    }
}
