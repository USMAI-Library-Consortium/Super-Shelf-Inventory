import {Component, OnDestroy, OnInit} from "@angular/core";
import {BehaviorSubject, of, Subscription} from "rxjs";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {Router} from "@angular/router";

import {ExportJobService} from "../services/apis/export-job.service";
import {PhysicalItemInfoService} from "../services/fileParsing/physical-item-info.service";
import {BarcodeParserService} from "../services/fileParsing/barcode-parser.service";
import {IndividualItemInfoService} from "../services/apis/individual-item-info.service";
import {switchMap, tap} from "rxjs/operators";
import {AlertService} from "@exlibris/exl-cloudapp-angular-lib";
import {SetService} from "../services/apis/set.service";

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
        private alert: AlertService,
        private setService: SetService,
    ) {
    }

    ngOnInit(): void {
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

    onSubmit() {
        this.loading$.next(true)
        this.loadDataSubscription = this.piis.getLatestPhysicalItems().pipe(switchMap(items => {
            if (items[0].source === 'job') {
                return this.iii.pullTempLocationItemInfo(items)
            }
            return of(items)
        }), tap(items => this.piis.setLatestPhysicalItems(items))).subscribe(_ => {
            this.loading$.next(false);
            this.router.navigate(["configure-report"])
        }, err => {
            this.ready$.next(false);
            console.log(err)
            this.alert.error(`Issue parsing item info... ${err.message}. Resetting run.`)
            this.iii.reset()
            this.bps.reset()
            this.ejs.reset()
            this.setService.reset()
            setTimeout(() => {
                this.router.navigate(['/'])
            }, 5000)
        })
    }

    onFileSelect(event: Event) {
        this.ready$.next(false)
        const input = event.target as HTMLInputElement;
        this.loadDataSubscription = this.ejs.parseReport(input.files[0], this.bps.getBarcodes()).pipe(tap(physicalItems => this.piis.setLatestPhysicalItems(physicalItems))).subscribe(_ => {
            this.ready$.next(true);
        }, err => {
            this.ready$.next(false);
            console.log(err)
            this.alert.error(`Issue parsing item info... ${err.message}. Resetting run.`)
            this.iii.reset()
            this.bps.reset()
            this.ejs.reset()
            this.setService.reset()
            setTimeout(() => {
                this.router.navigate(['/'])
            }, 5000)
        })
    }
}
