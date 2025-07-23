import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject, timer} from "rxjs";
import {filter, map, switchMap, take, tap} from "rxjs/operators";
import {CloudAppRestService, HttpMethod} from "@exlibris/exl-cloudapp-angular-lib";

import {AlmaSet} from "./set.service";
import * as Papa from "papaparse";
import {PhysicalItem} from "../fileParsing/physical-item-info.service";

export interface AlmaJob {
    jobId: string,
    dataExtractUrl: string,
    jobDate: string
}

interface DataExportJobProgress {
    percentage: number,
    status: string,
    id: string
}

@Injectable({
    providedIn: 'root'
})
export class ExportJobService {
    public dataExportJobProgress$: Subject<DataExportJobProgress> = new Subject();
    private job: AlmaJob = null
    private parsedPhysicalItems$: BehaviorSubject<PhysicalItem[] | null> = new BehaviorSubject(null)

    constructor(private restService: CloudAppRestService) {
    }

    public getJob() {
        return this.job
    }

    public usePreviousRun(previousRunInfo: AlmaJob) {
        this.job = previousRunInfo
    }

    public runExportJob(set: AlmaSet): Observable<AlmaJob> {
        this.job = null
        return this.restService
            .call({
                url: "/conf/jobs/M48?op=run",
                method: HttpMethod.POST,
                headers: {
                    "Content-Type": "application/xml",
                    Accept: "application/json",
                },
                requestBody: this.formatRequestBody(set),
            })
            .pipe(switchMap(result => this.waitForJob(result)));
    }

    private formatRequestBody(set: AlmaSet) {
        return `<job>
        <parameters>
          <parameter>
            <name>task_ExportParams_outputFormat_string</name>
            <value>CSV</value>
          </parameter>
          <parameter>
            <name>task_ExportParams_exportFolder_string</name>
            <value>PRIVATE</value>
          </parameter>
          <parameter>
            <name>task_ExportParams_ftpConfig_string</name>
            <value></value>
          </parameter>
          <parameter>
            <name>task_ExportParams_ftpSubdirectory_string</name>
            <value></value>
          </parameter>
          <parameter>
            <name>set_id</name>
            <value>${set.id}</value>
          </parameter>
          <parameter>
            <name>job_name</name>
            <value>${set.name}</value>
          </parameter>
        </parameters>
      </job>
      `
    }

    private waitForJob(result: object): Observable<AlmaJob> {
        const job: AlmaJob = {
            jobId: this.parseJobIdFromUrl(result["additional_info"]["link"]),
            // url: (result["additional_info"]["link"] as string).replace("/almaws/v1", "")
            dataExtractUrl: result["additional_info"]["link"],
            jobDate: new Date().getTime().toString()
        }

        return this.checkJobProgress(job.dataExtractUrl, job.jobId).pipe(map(result => {
            return job
        }), tap(almaJob => {
            this.job = almaJob
        }));
    }

    private checkJobProgress(url: string, id: string) {
        return timer(0, 3000).pipe(
            switchMap(() =>
                this.restService.call({
                    url,
                    headers: {
                        Accept: "application/json",
                    },
                })
            ),
            tap((result) => {
                this.dataExportJobProgress$.next({
                    percentage: result["progress"],
                    status: result["status"]['desc'],
                    id
                })
            }),
            filter((result) => result["progress"] === 100 && result["status"]['value'] === "COMPLETED_SUCCESS"),
            take(1)
        );
    }

    public parseJobIdFromUrl(url: string) {
        return url.replace(
            "/almaws/v1/conf/jobs/M48/instances/",
            "")
    }

    public parseReport(file: Papa.LocalFile | string, barcodes: string[]): Observable<PhysicalItem[]> {
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
                        lastLoanDate: string,
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
                        lastLoanDate: row["Last loan"] ? new Date(row["Last loan"]).getTime().toString() : null,
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
                            source: 'job',
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
                            lastLoanDate: data.lastLoanDate,
                            hasTempLocation: data.hasTempLocation,
                            inTempLocation: null,
                            requested: data.requested,
                        })
                    } else {
                        // Item does NOT exist in Alma
                        physicalItems.push({
                            barcode,
                            existsInAlma: false,
                            source: 'job',
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
                            requested: null,
                        })
                    }
                })
                this.parsedPhysicalItems$.next(physicalItems)
            }
        })
        return this.getLatestParsedPhysicalItems()
    }

    public getLatestParsedPhysicalItems() {
        return this.parsedPhysicalItems$.pipe(filter(physicalItems => {
            return physicalItems instanceof Array
        }), take(1))
    }

    reset() {
        this.job = null
        this.parsedPhysicalItems$.next(null)
    }
}
