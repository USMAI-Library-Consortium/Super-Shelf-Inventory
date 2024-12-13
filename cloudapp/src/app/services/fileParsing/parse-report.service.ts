import {Injectable} from '@angular/core';
import * as Papa from 'papaparse'
import {BehaviorSubject, Observable} from 'rxjs';
import {filter, take} from "rxjs/operators";

export interface PhysicalItem {
    barcode: string,
    existsInAlma: boolean,

    mmsId: string | null,
    holdingId: string | null,
    pid: string | null,

    title: string | null,
    callNumber: string | null,
    description: string | null,
    library: string | null,
    location: string | null,
    itemMaterialType: string | null,
    policyType: string | null,
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
export class ParseReportService {
    private physicalItems$: BehaviorSubject<PhysicalItem[] | null> = new BehaviorSubject(null)

    constructor() {
    }

    public getLatestPhysicalItems() {
        return this.physicalItems$.pipe(filter(physicalItems => {
            return physicalItems instanceof Array
        }), take(1))
    }

    public reset() {
        this.physicalItems$.next(null)
    }

    parseReport(file: Papa.LocalFile | string, barcodes: string[]): Observable<PhysicalItem[]> {
        this.physicalItems$.next(null)
        Papa.parse(file, {
            header: true, // If your CSV has headers
            delimiter: ",",
            escapeChar: "\\",
            transformHeader: (header) => header.trim(),
            complete: (results: any) => {
                const dataLookup: {
                    [key: string]: {
                        title: string,
                        callNumber: string,
                        description: string,
                        mmsId: string,
                        holdingId: string,
                        pid: string,
                        library: string,
                        location: string,
                        itemMaterialType: string,
                        policyType: string,
                        status: string,
                        processType: string,
                        lastModifiedDate: string,
                        hasTempLocation: boolean,
                        requested: boolean
                    }
                } = {}

                results.data.forEach(row => {
                    dataLookup[row["Barcode"]] = {
                        title: row["Title"],
                        callNumber: row["Call Number"],
                        description: row["Description"],
                        mmsId: row["MMS Record ID"],
                        holdingId: row["HOL Record ID"],
                        pid: row["Item PID"],
                        library: row["Local Location"],
                        location: row["Permanent Physical Location"],
                        itemMaterialType: row["Item Material Type"],
                        policyType: row["Policy"],
                        status: row["Status"],
                        processType: row["Process type"],
                        lastModifiedDate: row["Modification date"] ? new Date(row["Modification date"]).getTime().toString() : new Date(row["Creation date"]).getTime().toString(),
                        hasTempLocation: row["Temp library"] && row["Temp location"],
                        requested: row["Process type"] === "REQUESTED"
                    }
                })

                const physicalItems: PhysicalItem[] = []
                barcodes.forEach(barcode => {
                    if (dataLookup.hasOwnProperty(`'${barcode}'`)) {
                        // If the item is in Alma...
                        const data = dataLookup[`'${barcode}'`]
                        physicalItems.push({
                            barcode,
                            existsInAlma: true,
                            title: data.title,
                            description: data.description.replace(" ", ""),
                            mmsId: data.mmsId?.replace(/'/g, ""),
                            holdingId: data.holdingId?.replace(/'/g, ""),
                            pid: data.pid?.replace(/'/g, ""),
                            callNumber: data.callNumber,
                            library: data.library,
                            location: data.location,
                            policyType: data.policyType,
                            itemMaterialType: data.itemMaterialType,
                            status: data.status,
                            processType: data.processType,
                            lastModifiedDate: data.lastModifiedDate,
                            hasTempLocation: data.hasTempLocation,
                            inTempLocation: null,
                            requested: data.requested,
                        })
                    } else {
                        // Item does NOT exist in Alma
                        physicalItems.push({
                            barcode,
                            existsInAlma: false,
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
                            inTempLocation: null,
                            hasTempLocation: null,
                            requested: null,
                        })
                    }
                })
                this.physicalItems$.next(physicalItems)
            }
        })
        return this.getLatestPhysicalItems()
    }
}
