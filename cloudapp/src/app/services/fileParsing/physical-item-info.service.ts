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
    libraryName?: string | null,
    location: string | null,
    locationName?: string | null,
    itemMaterialType: string | null,
    itemMaterialTypeName?: string,
    policyType: string | null,
    policyTypeName?: string | null,
    status: string | null,
    processType: string | null,
    lastModifiedDate: number | null,
    lastLoanDate: number | null | -1,
    hasTempLocation: boolean | null,
    inTempLocation: boolean | null,
    requested: boolean | null
}

@Injectable({
    providedIn: 'root'
})
export class PhysicalItemInfoService {
    public physicalItems: PhysicalItem[] | undefined

    constructor() {
    }

    public reset() {
        this.physicalItems = undefined
    }
}
