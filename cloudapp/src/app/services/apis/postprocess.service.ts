import {Injectable} from '@angular/core';
import {BehaviorSubject, forkJoin, Observable, of, Subject} from "rxjs";
import {catchError, filter, map, take, tap} from "rxjs/operators";
import {AlertService, CloudAppRestService, HttpMethod} from "@exlibris/exl-cloudapp-angular-lib";

import {AlmaSet} from "./set.service";
import {AlmaJob} from "./export-job.service";
import {ProcessedPhysicalItem} from "../dataProcessing/report.service";


interface ScanInResults {
    wasRun: boolean,
    successful: number,
    failed: number
}

interface ScanInJobProgress {
    scanned: number,
    total: number
}

interface MarkAsInventoriedJob extends AlmaJob {
    markAsInventoriedField: string
}

@Injectable({
    providedIn: 'root'
})

export class PostprocessService {
    public scanInJobProgress$: Subject<ScanInJobProgress> = new Subject();

    private scanInDone$: BehaviorSubject<ScanInResults | null> = new BehaviorSubject(null);
    private markAsInventoriedStarted$: BehaviorSubject<MarkAsInventoriedJob | null> = new BehaviorSubject(null);

    constructor(private restService: CloudAppRestService,
                private alert: AlertService) {
    }

    public getLatestScanInResults(): Observable<ScanInResults> {
        return this.scanInDone$.pipe(filter(scanInResults => !!scanInResults), take(1))
    }

    public getLatestMarkAsInventoriedStarted(): Observable<MarkAsInventoriedJob> {
        return this.markAsInventoriedStarted$.pipe(filter(job => !!job), take(1))
    }

    public reset() {
        this.scanInDone$.next(null);
        this.markAsInventoriedStarted$.next(null);
    }

    public scanInItems(physicalItems: ProcessedPhysicalItem[], library: string, circDesk: string): Observable<ScanInResults> {
        const requests: Observable<boolean>[] = []
        let numScanned: number = 0
        for (let item of physicalItems.filter(item => {
            return item.needsToBeScannedIn
        })) {
            requests.push(this.restService.call({
                url: `/almaws/v1/bibs/${item.mmsId}/holdings/${item.holdingId}/items/${item.pid}?op=scan&external_id=false&library=${library}&circ_desk=${circDesk}&done=true&auto_print_slip=false&place_on_hold_shelf=false&confirm=false&register_in_house_use=false`,
                method: HttpMethod.POST
            }).pipe(catchError(err => {
                console.log(err)
                return of(false)
            }), map(value => {
                if (value) {
                    item.wasScannedIn = true
                } else {
                    this.alert.error(`Failed scanning in item ${item.barcode}`)
                }
                return !!value;
            }), tap(_ => {
                numScanned += 1
                this.scanInJobProgress$.next({
                    total: requests.length,
                    scanned: numScanned
                })
            })))
        }

        if (!requests) return of({
            successful: 0,
            failed: 0,
            wasRun: true
        })


        return forkJoin(requests).pipe(map(results => {
            const successful = results.filter(Boolean).length
            const failed = results.length - successful
            return {
                successful,
                failed,
                wasRun: true
            }
        }), tap(result => {
            this.scanInDone$.next(result)
        }))
    }

    public markAsInventoried(inventoryField: string, scanDate: string, set: AlmaSet): Observable<MarkAsInventoriedJob> {
        const formattedScanDate: string = `Last Inventoried on ${(new Date(scanDate)).toISOString().slice(0, 10)}`
        return this.restService.call({
            url: "/conf/jobs/M18?op=run",
            method: HttpMethod.POST,
            headers: {
                "Content-Type": "application/xml",
                Accept: "application/json",
            },
            requestBody: this.getRequestBody(inventoryField, formattedScanDate, scanDate, set),
        }).pipe(map(result => {
                return {
                    jobId: (result["additional_info"]["link"] as string).replace(
                        "/almaws/v1/conf/jobs/M18/instances/",
                        ""),
                    dataExtractUrl: (result["additional_info"]["link"] as string).replace("/almaws/v1", ""),
                    jobDate: new Date().getTime().toString(),
                    markAsInventoriedField: inventoryField
                }
            }),
            catchError(err => {
                console.log(err)
                return of({
                    jobId: set.id.toString(),
                    jobDate: null,
                    dataExtractUrl: null,
                    markAsInventoriedField: null
                })
            }),
            tap(result => {
                this.markAsInventoriedStarted$.next(result)
            }))
    }

    private getRequestBody(inventoryField: string, formattedScanDate: string, scanDate: string, set: AlmaSet) {
        const timestamp = new Date(scanDate).getTime()
        const job = `<job>
                            <parameters>
                                <parameter>
                                    <name>IS_MAGNETIC_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>REPLACEMENT_COST_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYL_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONC_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ITEM_POLICY_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>PROVENANCE_CODE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>PHYSICAL_CONDITION_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYM_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>STORAGE_LOCATION_ID_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_3_selected</name>
                                    <value>${inventoryField === "internal_note_3"}</value>
                                </parameter>
                                <parameter>
                                    <name>EXPECTED_RECIEVED_DATE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>RECEIVE_NUMBER_condition</name>
                                    <value/>
                                </parameter>
                                <parameter>
                                    <name>PUBLIC_NOTE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>EXPECTED_RECIEVED_DATE_value</name>
                                    <value>0</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_1_value</name>
                                    <value>${inventoryField === "internal_note_1" ? formattedScanDate : ""}</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYJ_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>TEMP_PHYSICAL_CALL_NUMBER_TYPE_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONG_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYI_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>WEEDING_NUMBER_condition</name>
                                    <value/>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_3_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONB_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONE_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>MISSING_STATUS_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>DEPARTMENT_condition</name>
                                    <value/>
                                </parameter>
                                <parameter>
                                    <name>IN_PROCESS_TYPE_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ITEM_POLICY_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>PAGES_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_2_selected</name>
                                    <value>${inventoryField === "internal_note_2"}</value>
                                </parameter>
                                <parameter>
                                    <name>ITEM_POLICY_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>REPLACEMENT_COST_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>MISSING_STATUS_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>EXPECTED_RECIEVED_DATE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>FULFILLMENT_NOTE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>PIECES_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONH_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_PRICE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>IS_MAGNETIC_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>FULFILLMENT_NOTE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ALTERNATIVE_PHYSICAL_CALL_NUMBER_TYPE_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>DUE_BACK_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>TEMPORARYITEMPOLICY_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONH_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_3_value</name>
                                    <value>${inventoryField === "statistics_note_3" ? formattedScanDate : ""}</value>
                                </parameter>
                                <parameter>
                                    <name>RECEIVE_NUMBER_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONA_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>WEEDING_DATE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>RETENTION_REASON_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>MISSING_STATUS_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>REMOVE_TRANSIT_FOR_RESHELVING_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>clearAllTemporaryInformation</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ORDER_NUMBER_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_1_selected</name>
                                    <value>${inventoryField === "internal_note_1"}</value>
                                </parameter>
                                <parameter>
                                    <name>ALTERNATIVE_PHYSICAL_CALL_NUMBER_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_1_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYI_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIOND_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>PROVENANCE_CODE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONG_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>PHYSICAL_CONDITION_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_NUMBER_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>FULFILLMENT_NOTE_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONC_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>PAGES_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>DUE_BACK_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>TEMP_PHYSICAL_CALL_NUMBER_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>REPLACEMENT_COST_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>clearTemporaryLibraryAndLocation</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>RECIEVED_DATE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ALTERNATIVE_PHYSICAL_CALL_NUMBER_TYPE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ISSUE_DATE_value</name>
                                    <value>0</value>
                                </parameter>
                                <parameter>
                                    <name>ALT_NUMBER_SOURCE_condition</name>
                                    <value/>
                                </parameter>
                                <parameter>
                                    <name>ALT_NUMBER_SOURCE_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>PAGES_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONB_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_1_selected</name>
                                    <value>${inventoryField === "statistics_note_1"}</value>
                                </parameter>
                                <parameter>
                                    <name>MATERIAL_TYPE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_DATE_value</name>
                                    <value>${inventoryField === "inventory_date" ? timestamp : 0}</value>
                                </parameter>
                                <parameter>
                                    <name>PUBLIC_NOTE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYI_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONC_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYK_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYL_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>WEEDING_DATE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>PIECES_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>RETENTION_NOTE_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>TEMP_PHYSICAL_CALL_NUMBER_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONF_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>COPY_ID_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYJ_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>RETENTION_NOTE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONF_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>RECEIVE_NUMBER_value</name>
                                    <value/>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIOND_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>TEMP_PHYSICAL_CALL_NUMBER_TYPE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_1_value</name>
                                    <value>${inventoryField === "statistics_note_1" ? formattedScanDate : ""}</value>
                                </parameter>
                                <parameter>
                                    <name>PIECES_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>TEMP_PHYSICAL_CALL_NUMBER_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYJ_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>REMOVE_RS_TRANSIT_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>MATERIAL_TYPE_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ORDER_NUMBER_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>COPY_ID_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYM_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_3_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_1_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONA_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>RECIEVED_DATE_value</name>
                                    <value>0</value>
                                </parameter>
                                <parameter>
                                    <name>DEPARTMENT_value</name>
                                    <value/>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYK_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>PUBLIC_NOTE_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_3_selected</name>
                                    <value>${inventoryField === "statistics_note_3"}</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_2_value</name>
                                    <value>${inventoryField === "internal_note_2" ? formattedScanDate : ""}</value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_DATE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONA_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>COMMITTED_TO_RETAIN_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>TEMPORARYITEMPOLICY_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIOND_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_PRICE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>STORAGE_LOCATION_ID_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ORDER_NUMBER_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>WEEDING_NUMBER_value</name>
                                    <value/>
                                </parameter>
                                <parameter>
                                    <name>ALTERNATIVE_PHYSICAL_CALL_NUMBER_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>WEEDING_DATE_value</name>
                                    <value>0</value>
                                </parameter>
                                <parameter>
                                    <name>COMMITTED_TO_RETAIN_value</name>
                                    <value>0</value>
                                </parameter>
                                <parameter>
                                    <name>PROVENANCE_CODE_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>COPY_ID_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>RETENTION_REASON_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>IS_MAGNETIC_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_NUMBER_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>DUE_BACK_value</name>
                                    <value>0</value>
                                </parameter>
                                <parameter>
                                    <name>ALT_NUMBER_SOURCE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>MATERIAL_TYPE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>RECIEVED_DATE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_PRICE_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONB_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>RETENTION_REASON_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>RECIEVING_OPERATOR_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>RECIEVING_OPERATOR_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONG_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>copyItemToHost</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>TEMP_PHYSICAL_CALL_NUMBER_TYPE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ISSUE_DATE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_2_selected</name>
                                    <value>${inventoryField === "statistics_note_2"}</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYK_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_2_value</name>
                                    <value>${inventoryField === "statistics_note_2" ? formattedScanDate : ""}</value>
                                </parameter>
                                <parameter>
                                    <name>PHYSICAL_CONDITION_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>DEPARTMENT_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_NUMBER_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>STORAGE_LOCATION_ID_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>INVENTORY_DATE_selected</name>
                                    <value>${inventoryField === "inventory_date"}</value>
                                </parameter>
                                <parameter>
                                    <name>IN_PROCESS_TYPE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONE_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYL_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>RETENTION_NOTE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ALTERNATIVE_PHYSICAL_CALL_NUMBER_TYPE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>TEMPORARYITEMPOLICY_value</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>WEEDING_NUMBER_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>CHRONOLOGYM_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>RECIEVING_OPERATOR_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ALTERNATIVE_PHYSICAL_CALL_NUMBER_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONH_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>ISSUE_DATE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_2_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>IN_PROCESS_TYPE_selected</name>
                                    <value>false</value>
                                </parameter>
                                <parameter>
                                    <name>INTERNAL_NOTE_3_value</name>
                                    <value>${inventoryField === "internal_note_3" ? formattedScanDate : ""}</value>
                                </parameter>
                                <parameter>
                                    <name>STATISTICS_NOTE_2_condition</name>
                                    <value>Null</value>
                                </parameter>
                                <parameter>
                                    <name>ENUMERATIONF_value</name>
                                    <value></value>
                                </parameter>
                                <parameter>
                                    <name>set_id</name>
                                    <value>${set.id}</value>
                                </parameter>
                                <parameter>
                                    <name>job_name</name>
                                    <value>Change Physical items information - ${set.name}</value>
                                </parameter>
                            </parameters>
                        </job>

            `
        console.log(job)
        return job;
    }
}
