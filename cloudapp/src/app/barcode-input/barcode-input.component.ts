import {Component, OnDestroy, OnInit} from "@angular/core";
import {Validators, FormBuilder, FormGroup} from "@angular/forms";
import {Router} from "@angular/router";
import {StateService, PreviousRun} from "../services/apis/state.service";
import {BehaviorSubject, of, Subscription} from "rxjs";
import {AlertService, CloudAppEventsService} from "@exlibris/exl-cloudapp-angular-lib";
import {ExportJobService} from "../services/apis/export-job.service";
import {BarcodeParserService} from "../services/fileParsing/barcode-parser.service";
import {switchMap, tap} from "rxjs/operators";
import {SetService} from "../services/apis/set.service";

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
    public isAdmin$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public jobRunning$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public previousRun: PreviousRun = null;

    private enableUseCachedResultsSubscription: Subscription;
    private loadingSubscription: Subscription;
    private loadDataSubscription: Subscription;
    private isAdminSubscription: Subscription;
    private barcodeSubscription: Subscription;
    private findSimilarRunsSubscription: Subscription;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private stateService: StateService,
        private bps: BarcodeParserService,
        public setService: SetService,
        public ejs: ExportJobService,
        private eventsService: CloudAppEventsService,
        private alert: AlertService,
    ) {
    }

    ngOnInit(): void {
        this.barcodeForm = this.fb.group({
            barcodeXLSXFile: [null, Validators.required],
            scanDate: [null, Validators.required],
            useCachedResults: [false, Validators.required],
        });

        this.enableUseCachedResultsSubscription =
            this.enableUseCachedResults$.subscribe((shouldEnable) => {
                // We want to choose 'true' to the default if this is shown, because it will be shown in the even that
                // there are cached results. Else, it will silently be set to 'false'.
                shouldEnable
                    ? this.barcodeForm.get("useCachedResults").enable()
                    : this.barcodeForm.get("useCachedResults").disable();
            });
        this.loadingSubscription = this.loading$.subscribe((isLoading) => {
            isLoading
                ? this.barcodeForm.get("barcodeXLSXFile").disable()
                : this.barcodeForm.get("barcodeXLSXFile").enable();
        });
        this.isAdminSubscription = this.eventsService.getInitData().subscribe(initData => {
            this.isAdmin$.next(initData.user.isAdmin)
        })

    }

    ngOnDestroy(): void {
        this.enableUseCachedResultsSubscription.unsubscribe();
        this.loadingSubscription.unsubscribe();
        if (this.loadDataSubscription) this.loadDataSubscription.unsubscribe();
        this.isAdminSubscription.unsubscribe();
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
                this.bps.setFileInfo({
                    inputFileName: fileName,
                    firstBarcode: barcodes[0],
                    numberOfRecords: barcodes.length
                })
            }, _ => {
                this.barcodeForm.get("barcodeXLSXFile").setValue(null);
                this.loading$.next(false);
            })
        } else {
            this.loading$.next(false);
        }
    }

    public onSubmit() {
        const useCachedResults: boolean = this.barcodeForm.get("useCachedResults").value
        const scanDate: string = this.barcodeForm.get("scanDate").value
        this.bps.setScanDate(scanDate)

        if (useCachedResults) {
            this.ejs.usePreviousRun({
                jobDate: this.previousRun.jobDate,
                dataExtractUrl: this.previousRun.dataExtractUrl,
                jobId: this.ejs.parseJobIdFromUrl(this.previousRun.dataExtractUrl)
            })
            this.router.navigate(["job-results-input"])
        } else {
            this.jobRunning$.next(true)
            this.loadDataSubscription = this.bps.getLatestBarcodes().pipe(switchMap(barcodes => {
                return this.setService.createSet(barcodes)
            }), switchMap(almaSet => {
                return this.ejs.runExportJob(almaSet)
            }), switchMap(almaJob => {
                return this.bps.getLatestFileInfo().pipe(switchMap(fileInfo => {
                    return this.stateService.saveRun(fileInfo.inputFileName, fileInfo.numberOfRecords, fileInfo.firstBarcode, almaJob.jobDate, almaJob.dataExtractUrl, almaJob.jobId)
                }), switchMap(_ => of(almaJob)))
            })).subscribe(_ => {
                this.router.navigate(["job-results-input"])
            }, error => {
                // Reset the component
                this.alert.error(error.message + " (Applies to API only)")
                this.bps.reset()
                this.ejs.reset()
                this.setService.reset()
                this.jobRunning$.next(false)
                this.barcodeForm.get("barcodeXLSXFile").setValue(null)
                this.barcodeForm.get("scanDate").setValue(null)
                this.barcodeForm.get("useCachedResults").setValue(null)
                this.enableUseCachedResults$.next(false);
            })
        }

    }
}

