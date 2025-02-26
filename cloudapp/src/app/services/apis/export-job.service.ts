import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject, timer} from "rxjs";
import {filter, map, switchMap, take, tap} from "rxjs/operators";
import {CloudAppRestService, HttpMethod} from "@exlibris/exl-cloudapp-angular-lib";

import {AlmaSet} from "./set.service";

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
    private job$: BehaviorSubject<AlmaJob | null> = new BehaviorSubject(null);

    constructor(private restService: CloudAppRestService) {
    }

    public getLatestRunInfo() {
        return this.job$.pipe(filter(jobOutput => !!jobOutput), take(1))
    }

    public usePreviousRun(previousRunInfo: AlmaJob) {
        this.job$.next(previousRunInfo);
    }

    public runExportJob(set: AlmaSet): Observable<AlmaJob> {
        this.job$.next(null)
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
            this.job$.next(almaJob);
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
                console.log(result)
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

    reset() {
        this.job$.next(null)
    }
}
