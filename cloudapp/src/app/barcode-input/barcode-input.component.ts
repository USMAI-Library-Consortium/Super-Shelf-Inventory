import {Component, OnDestroy, OnInit} from "@angular/core";
import {Validators, FormBuilder, FormGroup} from "@angular/forms";
import {Router} from "@angular/router";
import {AlmaJobService} from "../alma-job.service";
import {StateService, PreviousRun} from "../state.service";
import {BehaviorSubject, Subscription} from "rxjs";
import {CloudAppEventsService} from "@exlibris/exl-cloudapp-angular-lib";

@Component({
    selector: "app-barcode-input",
    templateUrl: "./barcode-input.component.html",
    styleUrls: ["./barcode-input.component.scss"],
})
export class BarcodeInputComponent implements OnInit, OnDestroy {
    barcodeForm: FormGroup;

    enableUseCachedResults$: BehaviorSubject<boolean> = new BehaviorSubject(
        false
    );
    loading$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    isAdmin$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    private inputFileName: string = null;
    private firstBarcode: string = null;
    previousRun: PreviousRun = null;

    private enableUseCachedResultsSubscription: Subscription;
    private loadingSubscription: Subscription;
    private isAdminSubscription: Subscription;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private ajs: AlmaJobService,
        private stateService: StateService,
        private eventsService: CloudAppEventsService
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
        this.isAdminSubscription.unsubscribe();
    }

    onFileSelect(event: Event): void {
        this.enableUseCachedResults$.next(false);
        this.loading$.next(true);
        this.previousRun = null
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.ajs.excelFile = input.files[0]; // Store the actual file
            this.ajs.fileName = input.files[0].name;
            this.ajs.fileLastModifiedDate = new Date(input.files[0].lastModified)

            // Preprocess file.
            this.ajs.parseExcelFile().subscribe(
                (barcodes) => {
                    if (barcodes) {
                        this.barcodeForm.get("scanDate").setValue(this.ajs.fileLastModifiedDate);
                        this.stateService
                            .checkIfCachedResults({
                                numberOfRecords: barcodes.length,
                                inputFileName: this.ajs.fileName,
                                firstBarcode: barcodes[0],
                            })
                            .subscribe((result) => {
                                this.loading$.next(false);
                                this.inputFileName = input.files[0].name;
                                this.firstBarcode = barcodes[0];
                                if (result) {
                                    this.enableUseCachedResults$.next(true);
                                    this.previousRun = result;
                                }
                            });
                    } else {
                        this.barcodeForm.get("barcodeXLSXFile").setValue(null);
                        this.loading$.next(false);
                    }
                },
                (error) => {
                    this.barcodeForm.get("barcodeXLSXFile").setValue(null);
                    this.loading$.next(false);
                }
            );
        }
    }

    public onSubmit() {
        if (this.barcodeForm.get("useCachedResults").value === true) {
            this.ajs.loadData({...this.previousRun, scanDate: this.barcodeForm.get("scanDate").value});
        } else {
            this.ajs.loadData({
                numberOfRecords: this.ajs.barcodes.length,
                firstBarcode: this.firstBarcode,
                inputFileName: this.inputFileName,
                scanDate: this.barcodeForm.get("scanDate").value,
                barcodes: this.ajs.barcodes,
            })
        }
        this.router.navigate(["loading"]);
    }
}
