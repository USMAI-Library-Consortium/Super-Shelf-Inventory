import {Component, OnDestroy, OnInit} from "@angular/core";
import {Validators, FormBuilder, FormGroup} from "@angular/forms";
import {Router} from "@angular/router";
import {BehaviorSubject, of, Subscription, throwError} from "rxjs";
import {catchError, switchMap} from "rxjs/operators";
import {AlertService} from "@exlibris/exl-cloudapp-angular-lib";

import {StateService, PreviousRun} from "../services/apis/state.service";
import {ExportJobService} from "../services/apis/export-job.service";
import {SetService} from "../services/apis/set.service";
import {BarcodeParserService} from "../services/fileParsing/barcode-parser.service";
import {BackupItemExportService} from "../services/apis/backup-item-export.service";
import {PhysicalItemInfoService} from "../services/fileParsing/physical-item-info.service";

@Component({
    selector: "app-barcode-input",
    templateUrl: "./barcode-input.component.html",
    styleUrls: ["./barcode-input.component.scss"],
})
export class BarcodeInputComponent implements OnInit, OnDestroy {
    public barcodeForm: FormGroup;

    public enableUseCachedResults$: BehaviorSubject<boolean> = new BehaviorSubject(
        false
    );
    public loading$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public dataLoadRunning$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public previousRun: PreviousRun = null;
    public mode: string = "api"

    private enableUseCachedResultsSubscription: Subscription;
    private jobModeSubscription: Subscription;
    private loadingSubscription: Subscription;
    private loadDataSubscription: Subscription;
    private barcodeSubscription: Subscription;
    private findSimilarRunsSubscription: Subscription;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private stateService: StateService,
        private bps: BarcodeParserService,
        public setService: SetService,
        public ejs: ExportJobService,
        public bies: BackupItemExportService,
        private alert: AlertService,
        private piis: PhysicalItemInfoService,
    ) {
    }

    ngOnInit(): void {
        this.barcodeForm = this.fb.group({
            barcodeXLSXFile: [null, Validators.required],
            scanDate: [null, Validators.required],
            useCachedResults: [false, Validators.required],
            mode: ["api", Validators.required],
        });

        this.enableUseCachedResultsSubscription =
            this.enableUseCachedResults$.subscribe((shouldEnable) => {
                // We want to choose 'true' to the default if this is shown, because it will be shown in the even that
                // there are cached results. Else, it will silently be set to 'false'.
                shouldEnable
                    ? this.barcodeForm.get("useCachedResults").enable()
                    : this.barcodeForm.get("useCachedResults").disable();
            });

        this.jobModeSubscription = this.barcodeForm.get("mode")?.valueChanges.subscribe(newMode => {
            this.mode = newMode;
            if (this.mode === "api") {
                this.enableUseCachedResults$.next(false)
            } else {
                if (this.previousRun) this.enableUseCachedResults$.next(true)
            }
        })

        this.loadingSubscription = this.loading$.subscribe((isLoading) => {
            isLoading
                ? this.barcodeForm.get("barcodeXLSXFile").disable()
                : this.barcodeForm.get("barcodeXLSXFile").enable();
        });

    }

    ngOnDestroy(): void {
        this.enableUseCachedResultsSubscription.unsubscribe();
        this.loadingSubscription.unsubscribe();
        this.jobModeSubscription.unsubscribe();
        if (this.loadDataSubscription) this.loadDataSubscription.unsubscribe();
        if (this.barcodeSubscription) this.barcodeSubscription.unsubscribe();
        if (this.findSimilarRunsSubscription) this.findSimilarRunsSubscription.unsubscribe();
    }

    public onFileSelect(event: Event): void {
        this.enableUseCachedResults$.next(false);
        this.loading$.next(true);
        this.previousRun = null
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const excelFile = input.files[0]; // Store the actual file
            const fileName = input.files[0].name;
            const fileLastModifiedDate = new Date(input.files[0].lastModified)

            this.barcodeSubscription = this.bps.parseExcelFile(excelFile).subscribe(barcodes => {
                if (!barcodes) {
                    this.barcodeForm.get("barcodeXLSXFile").setValue(null);
                    this.loading$.next(false);
                    return
                }
                this.barcodeForm.get("scanDate").setValue(fileLastModifiedDate)
                this.findSimilarRunsSubscription = this.stateService.findSimilarRuns(fileName, barcodes.length, barcodes[0]).subscribe(result => {
                    if (result) {
                        this.enableUseCachedResults$.next(true);
                        this.previousRun = result;
                    }
                    this.loading$.next(false);
                })
                this.bps.fileInfo = {
                    inputFileName: fileName,
                    firstBarcode: barcodes[0],
                    numberOfRecords: barcodes.length
                }
            }, _ => {
                this.barcodeForm.get("barcodeXLSXFile").setValue(null);
                this.loading$.next(false);
            })
        } else {
            this.loading$.next(false);
        }
    }

    private reset(mode: string) {
        this.previousRun = null
        this.barcodeForm.get("mode").setValue(mode)
        this.bps.reset()
        this.ejs.reset()
        this.bies.reset()
        this.setService.reset()
        this.dataLoadRunning$.next(false)
        this.barcodeForm.get("barcodeXLSXFile").setValue(null)
        this.barcodeForm.get("scanDate").setValue(null)
        this.barcodeForm.get("useCachedResults").setValue(false)
    }

    public onSubmit() {
        const useCachedResults: boolean = this.barcodeForm.get("useCachedResults").value
        this.bps.scanDate = this.barcodeForm.get("scanDate").value

        const mode: string = this.barcodeForm.get("mode").value

        if (mode === "api") {
            this.dataLoadRunning$.next(true)
            this.loadDataSubscription = this.bies.pullItemData(this.bps.getBarcodes()).subscribe(items => {
                this.piis.physicalItems = items
                this.router.navigate(["configure-report"])
            }, error => {
                // Reset the component
                if (error.status === 999) {
                    console.log("999 Error")
                    this.alert.error("ExLibris Service Error: Try 'Large Dataset' optimization mode.")
                }
                this.reset("job")
            })
        } else {
            if (useCachedResults) {
                this.ejs.usePreviousRun({
                    jobDate: this.previousRun.jobDate,
                    dataExtractUrl: this.previousRun.dataExtractUrl,
                    jobId: this.ejs.parseJobIdFromUrl(this.previousRun.dataExtractUrl)
                })
                this.router.navigate(["job-results-input"])
            } else {
                this.dataLoadRunning$.next(true)
                this.loadDataSubscription = this.setService.createSet(this.bps.getBarcodes()).pipe(switchMap(almaSet => {
                    if (!almaSet) throwError(new Error("Cannot create set. Please try again!"))
                    else return this.ejs.runExportJob(almaSet)
                }), catchError(err => {
                    // If there is an error with using the Jobs API, fall back to the API mode (fetching individual items).
                    console.log(err)
                    this.alert.warn("Error running Job - switching to API mode...")
                    this.barcodeForm.get("mode").setValue("api")
                    return this.bies.pullItemData(this.bps.getBarcodes())
                }), switchMap(result => {
                    // Save the job run, if the job was run.
                    if (result.hasOwnProperty("jobDate")) {
                        // It will be an Alma Job here
                        // @ts-ignore
                        return this.stateService.saveRun(this.bps.fileInfo.inputFileName, this.bps.fileInfo.numberOfRecords, this.bps.fileInfo.firstBarcode, result.jobDate, result.dataExtractUrl, result.jobId).pipe(switchMap(_ => of(result)))
                    } else {
                        // It is a physical item array here, pulled from the backup item export.
                        return of(result)
                    }
                })).subscribe(result => {
                    if (result.hasOwnProperty("jobDate")) {
                        console.log("Navigating")
                        this.router.navigate(["job-results-input"])
                    } else {
                        // Skip the results input, because we already have the data from the backup item
                        // exporter which gets individual item info.
                        console.log("Setting Results...")
                        // @ts-ignore
                        this.piis.physicalItems = result
                        this.router.navigate(["configure-report"])
                    }
                }, error => {
                    // Reset the component
                    console.log(error)
                    if (error.status === 999) {
                        this.alert.error("Fatal ExLibris Service Error")
                    } else {
                        this.reset("api")
                    }
                })
            }
        }
    }
}

