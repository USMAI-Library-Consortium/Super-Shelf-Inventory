import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {Router} from "@angular/router";

import {PostprocessService} from "../services/apis/postprocess.service";
import {ReportService} from "../services/dataProcessing/report.service";

@Component({
    selector: 'app-results',
    templateUrl: './results.component.html',
    styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, OnDestroy {

    reportDataSubscription: Subscription;

    constructor(public reportService: ReportService,
                public postprocessService: PostprocessService,
                private router: Router) {
    }

    ngOnInit(): void {}

    ngOnDestroy() {
        if (this.reportDataSubscription) this.reportDataSubscription.unsubscribe();
    }

    onSubmit() {
        this.router.navigate(['/'])
    }

    onBack() {
        this.router.navigate(['/', "configure-report"])
    }

    downloadReport() {
        this.reportService.generateAndDownloadExcel(this.reportService.getReport())
    }
}
