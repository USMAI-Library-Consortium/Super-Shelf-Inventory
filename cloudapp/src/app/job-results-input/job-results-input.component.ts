import {Component, OnDestroy, OnInit} from "@angular/core";
import {BehaviorSubject, Subscription} from "rxjs";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {Router} from "@angular/router";

import {ExportJobService} from "../services/apis/export-job.service";
import {PhysicalItemInfoService} from "../services/fileParsing/physical-item-info.service";
import {BarcodeParserService} from "../services/fileParsing/barcode-parser.service";
import {IndividualItemInfoService} from "../services/apis/individual-item-info.service";

@Component({
    selector: "app-job-results-input",
    templateUrl: "./job-results-input.component.html",
    styleUrls: ["./job-results-input.component.scss"],
})
export class JobResultsInputComponent implements OnInit, OnDestroy {
    public reportForm: FormGroup;
    public ready$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public loading$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    private loadDataSubscription: Subscription;

    constructor(
        public piis: PhysicalItemInfoService,
        public ejs: ExportJobService,
        private bps: BarcodeParserService,
        public iii: IndividualItemInfoService,
        private fb: FormBuilder,
        private router: Router,
    ) {
    }

    ngOnInit(): void {
        this.resetServices()
        this.reportForm = this.fb.group({
            reportFormInput: [null, Validators.required],
        });
    }

    ngOnDestroy(): void {
        if (this.loadDataSubscription) this.loadDataSubscription.unsubscribe();
    }

    onBack(): void {
        this.router.navigate(["/"])
    }

    private resetServices() {
        this.piis.reset()
    }

    onSubmit() {
        this.loading$.next(true)
        this.loadDataSubscription =  this.iii.pullTempLocationItemInfo(this.piis.physicalItems).subscribe(physicalItemsWithTempLocation => {
            this.piis.physicalItems = physicalItemsWithTempLocation
            this.loading$.next(false);
            this.router.navigate(["configure-report"])
        }, err => {
            console.log(err)
            let message: string = `Issue parsing item info... ${err.message}. Resetting run.`
            if (err.status === 999) message = "Fatal: ExLibris Service Error. We're working with ExLibris on this; you may have to wait to use the app."
            this.router.navigate(["/"], {
                queryParams: {
                    errorMessage: message
                }
            })
        })
    }

    onFileSelect(event: Event) {
        this.ready$.next(false)
        const input = event.target as HTMLInputElement;
        this.loadDataSubscription = this.ejs.parseReport(input.files[0], this.bps.getBarcodes()).subscribe(physicalItems => {
            this.piis.physicalItems = physicalItems
            this.ready$.next(true);
        }, err => {
            console.log(err)
            let message = `Issue parsing job file... ${err.message}. Resetting run.`
            this.router.navigate(["/"], {
                queryParams: {
                    errorMessage: message
                }
            })
        })
    }
}
