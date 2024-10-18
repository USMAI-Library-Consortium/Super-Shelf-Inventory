import {Injectable, OnDestroy} from "@angular/core";
import {AlertService, CloudAppRestService, HttpMethod} from "@exlibris/exl-cloudapp-angular-lib";
import * as XLSX from "xlsx";
import {combineLatest, from, Observable, of, ReplaySubject, Subject, timer} from "rxjs";
import {StateService} from "./state.service";
import {catchError, filter, map, switchMap, takeWhile, tap} from "rxjs/operators";

export interface RunJobOutput {
    barcodes: string[]
    setId: string;
    setName: string;
    reportIdentifier: string;
    scanDate: string;
    date: string;
}

interface ScanInResults {
    wasRun: boolean
    successful: number,
    failed: number
}

interface MarkAsInventoriedResults {
    wasRun: boolean
}

interface PostprocessResults {
    markAsInventoriedWasRun: boolean,
    scanInWasRun: boolean,
    itemsScannedIn: number,
    itemsFailedScanIn: number
}


@Injectable({
    providedIn: "root",
})
export class AlmaJobService implements OnDestroy {
    // Input barcode file
    public excelFile: Blob;

    // Data that this services parses and stores
    public fileName: string;
    public barcodes: string[] = null;
    public fileLastModifiedDate: Date;

    private setId: string = null;
    private setName: string = null;
    private scanDate: string = null;
    private dataExtractUrl: string = null;
    private markAsInventoriedJobUrl: string = null;

    // To aid with external logic.
    loadComplete$: ReplaySubject<RunJobOutput | null> = new ReplaySubject(1)
    userMessages$: Subject<string> = new Subject();

    // Postprocessing internal variables
    private markAsInventoriedComplete$: ReplaySubject<MarkAsInventoriedResults> = new ReplaySubject()
    private scanInComplete$: ReplaySubject<ScanInResults> = new ReplaySubject()

    public postprocessCompleteObservable$: Observable<PostprocessResults> = new Observable()
    public postprocessComplete$: ReplaySubject<PostprocessResults> = new ReplaySubject()

    constructor(
        private restService: CloudAppRestService,
        private alert: AlertService,
        private stateService: StateService
    ) {
        // Save the run information once it's done.
        this.loadComplete$.subscribe((runInfo) => {
            if (runInfo && runInfo.setId) {
                this.stateService
                    .saveRun(this.fileName, runInfo.barcodes.length, runInfo.barcodes[0], runInfo.reportIdentifier, runInfo.date)
                    .subscribe(() => {
                        console.log("Run Information Saved.")
                        this.userMessages$.next("Run Information Saved.");
                    }, () => {
                        this.userMessages$.next("RUN INFO NOT SAVED.");
                        this.alert.error("Run information could not be saved.")
                    });
            }
        })

        this.postprocessCompleteObservable$ = combineLatest([this.markAsInventoriedComplete$, this.scanInComplete$]).pipe(map(results => {
            return {
                markAsInventoriedWasRun: results[0].wasRun,
                scanInWasRun: results[1].wasRun,
                itemsScannedIn: results[1].successful,
                itemsFailedScanIn: results[1].failed
            }
        }))
        this.postprocessCompleteObservable$.subscribe(value => {
            this.postprocessComplete$.next(value)
        })
    }

    ngOnDestroy(): void {
        this.reset()
    }

    public getJobResults() {
        return this.loadComplete$.pipe(filter(runJobOutput => runJobOutput !== null))
    }

    public reset() {
        this.loadComplete$.next(null)
        this.excelFile = null
        this.fileName = null
        this.fileLastModifiedDate = null
        this.scanDate = null
        this.barcodes = null
        if (this.setId) {
            this.deleteSet().subscribe(result => {
                console.log("Set Deleted")
            }, error => {
                this.alert.error("Failed to delete set.")
            })
        }
    }

    private checkJobProgress(url: string) {
        return timer(0, 3000).pipe(
            switchMap(() =>
                this.restService.call({
                    url,
                    headers: {
                        Accept: "application/json",
                    },
                }).pipe(
                    catchError((error) => {
                        this.userMessages$.next(`Error: ${error.message}`);
                        return of({progress: 0}); // Default progress on error
                    })
                )
            ),
            tap((result) => {
                if (result["progress"] < 100) {
                    this.userMessages$.next(`Job progress is ${result["progress"]}%`);
                }
            }),
            takeWhile((result) => result["progress"] < 100, true) // Continue until progress is 100
        );
    }

    public loadData(input: any): void {
        this.loadComplete$.next(null);
        this.scanDate = input.scanDate
        if (input.hasOwnProperty("date")) {
            // This run has been completed previously
            this.loadComplete$.next({
                barcodes: this.barcodes,
                date: input.date,
                scanDate: this.scanDate,
                reportIdentifier: input.dataExtractUrl,
                setId: "",
                setName: "",
            });
        } else {
            this.createSet(true).subscribe(_ => {
                this.runJobOnSet()
            });
        }
    }

    public postprocess(inventoryField: string | null, scanInItems: boolean) {
        if (inventoryField) {
            if (!this.setId) {
                this.createSet(false).subscribe(result => {
                    this.markAsInventoried(inventoryField).subscribe(result => {
                        this.markAsInventoriedComplete$.next({
                            wasRun: true,
                        })
                    })
                })
            } else {
                this.markAsInventoried(inventoryField).subscribe(result => {
                    this.markAsInventoriedComplete$.next({
                        wasRun: true,
                    })
                })
            }
        } else this.markAsInventoriedComplete$.next({
            wasRun: false
        })

        if (scanInItems) {
            setTimeout(() => {
                this.scanInComplete$.next({
                    wasRun: false,
                    successful: 0,
                    failed: 0
                })
            }, 500)
        } else this.scanInComplete$.next({
            wasRun: false,
            successful: 0,
            failed: 0
        })
    }

    private markAsInventoried(inventoryField: string): Observable<void> {
        const formattedScanDate: string = `Last Inventoried on ${(new Date(this.scanDate)).toISOString().slice(0, 10)}`
        return this.restService.call({
            url: "/conf/jobs/M18?op=run",
            method: HttpMethod.POST,
            headers: {
                "Content-Type": "application/xml",
                Accept: "application/json",
            },
            requestBody: `<job>
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
                                    <value>${inventoryField === "inventory_date" ? this.scanDate : 0}</value>
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
                                    <value>${this.setId}</value>
                                </parameter>
                                <parameter>
                                    <name>job_name</name>
                                    <value>Change Physical items information - ${this.setName}</value>
                                </parameter>
                            </parameters>
                        </job>

            `,
        }).pipe(tap(result => {
            this.userMessages$.next(
                `Job with ID ${(result["additional_info"]["link"] as string).replace(
                    "/almaws/v1/conf/jobs/M18/instances/",
                    ""
                )} started.`
            );
            this.markAsInventoriedJobUrl = (result["additional_info"]["link"] as string).replace("/almaws/v1", "")
        }))
    }

    private runJobOnSet() {
        this.restService
            .call({
                url: "/conf/jobs/M48?op=run",
                method: HttpMethod.POST,
                headers: {
                    "Content-Type": "application/xml",
                    Accept: "application/json",
                },
                requestBody: `<job>
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
            <value>${this.setId}</value>
          </parameter>
          <parameter>
            <name>job_name</name>
            <value>${this.setName}</value>
          </parameter>
        </parameters>
      </job>
      `,
            })
            .subscribe((result) => {
                console.log(result);
                this.userMessages$.next(
                    `Job with ID ${(result["additional_info"]["link"] as string).replace(
                        "/almaws/v1/conf/jobs/M48/instances/",
                        ""
                    )} started.`
                );

                this.dataExtractUrl = (result["additional_info"]["link"] as string).replace("/almaws/v1", "")
                this.checkJobProgress(this.dataExtractUrl).subscribe(result => {
                    this.loadComplete$.next({
                        setId: this.setId,
                        setName: this.setName,
                        reportIdentifier: this.dataExtractUrl,
                        barcodes: this.barcodes,
                        scanDate: this.scanDate,
                        date: this.stateService.stringifyDate(new Date()),
                    });
                })
            });
    }

    private createSet(runJob: boolean) {
        const currentDate = new Date();
        const timestamp = `${
            currentDate.getMonth() + 1
        }-${currentDate.getDate()}-${currentDate.getFullYear()} ${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}`;
        const setName = `inventory_app ${timestamp}`;

        const newSet = {
            link: "",
            name: setName,
            description: "Set of physical items.",
            content: {
                value: "ITEM",
            },
            type: {
                value: "ITEMIZED",
            },
            private: {
                value: "true",
            },
        };

        const newSetMembers = {
            members: {
                total_record_count: this.barcodes.length,
                member: this.barcodes.map((barcode) => {
                    return {
                        link: "",
                        id: barcode,
                    };
                }),
            },
        };

        return this.restService
            .call({
                url: "/conf/sets",
                method: HttpMethod.POST,
                requestBody: newSet,
            }).pipe(switchMap(result => {
                return this.restService.call({
                    url: `/conf/sets/${result["id"]}?op=add_members&fail_on_invalid_id=false&id_type=BARCODE`,
                    method: HttpMethod.POST,
                    requestBody: newSetMembers,
                }).pipe(map(result => {
                    this.setId = result["id"];
                    this.setName = setName;
                    this.userMessages$.next(`Added ${result["number_of_members"]["value"]} members to the set`);
                    console.log(
                        `Added ${result["number_of_members"]["value"]} members to the set`
                    );
                }))
            }))
    }

    private deleteSet() {
        return this.restService
            .call({
                url: `/conf/sets/${this.setId}`,
                method: HttpMethod.DELETE,
                headers: {
                    Accept: "application/json",
                },
            });
    }

    public parseExcelFile() {
        this.loadComplete$.next(null)

        return from(
            this.excelFile.arrayBuffer().then(
                (data) => {
                    const items: string[] = [];
                    const workbook = XLSX.read(data, {
                        type: "binary",
                    });

                    const firstSheetName = workbook.SheetNames[0];
                    const rows: any[] = XLSX.utils.sheet_to_json(
                        workbook.Sheets[firstSheetName]
                    );
                    rows.forEach((row) => {
                        let barcode: string = null;
                        if ("barcode" in row) {
                            barcode = row["barcode"];
                        } else if ("Barcode" in row) {
                            barcode = row["Barcode"];
                        } else if ("BARCODE" in row) {
                            barcode = row["BARCODE"];
                        } else {
                            this.alert.error(`No barcode column in file; found columns ${Object.keys(row).join(", ")}`);
                            throw Error("Invalid Document.");
                        }

                        if (barcode) {
                            items.push(barcode);
                        }
                    });

                    this.userMessages$.next("Parsed Excel File successfully...");
                    console.log(`${items.length} items parsed from excel file.`);
                    this.barcodes = items;
                    return this.barcodes;
                },
                (reason) => {
                    this.alert.error("Error in parsing excel file. Ensure it is valid.");
                }
            )
        );
    }
}
