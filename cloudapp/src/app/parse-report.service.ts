import {Injectable} from '@angular/core';
import * as Papa from 'papaparse'
import {Observable, ReplaySubject, Subscription} from 'rxjs';
import {AlmaJobService, RunJobOutput} from "./alma-job.service";
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
    lastModifiedDate: number | null,
    inTempLocation: boolean | null,
    requested: boolean | null
}

@Injectable({
    providedIn: 'root'
})
export class ParseReportService {
    private loadComplete$: ReplaySubject<PhysicalItem[] | null> = new ReplaySubject(1)

    constructor() {
    }

    public getParsedPhysicalItems() {
        return this.loadComplete$.pipe(filter(physicalItems => {
            return physicalItems !== null
        }), take(1))
    }

    public reset() {
        this.loadComplete$.next(null)
    }

    parseReport(file: Papa.LocalFile | string, runJobOutput: RunJobOutput): Observable<PhysicalItem[]> {
        this.loadComplete$.next(null)
        Papa.parse(file, {
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
                        lastModifiedDate: number,
                        inTempLocation: boolean,
                        requested: boolean
                    }
                } = {}

                results.data.forEach(row => {
                    dataLookup[row[" Barcode"]] = {
                        title: row[" Title"],
                        callNumber: row[" Call Number"],
                        description: row["Description"],
                        mmsId: row["MMS Record ID"],
                        holdingId: row["HOL Record ID"],
                        pid: row["Item PID"],
                        library: row[" Local Location"],
                        location: row[" Permanent Physical Location"],
                        itemMaterialType: row[" Item Material Type"],
                        policyType: row[" Policy"],
                        status: row["Status"],
                        processType: row["Process type"],
                        lastModifiedDate: row["Modification date"] ? new Date(row["Modification date"]).valueOf() : new Date(row["Creation date"]).valueOf(),
                        inTempLocation: row["Temp library"] && row["Temp location"],
                        requested: row["Process type"] === "REQUESTED"
                    }
                })

                const physicalItems: PhysicalItem[] = []
                runJobOutput.barcodes.forEach(barcode => {
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
                            inTempLocation: data.inTempLocation,
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
                            requested: null,
                        })
                    }
                })
                this.loadComplete$.next(physicalItems)
            },
            header: true // If your CSV has headers
        })
        return this.getParsedPhysicalItems()
    }
}
