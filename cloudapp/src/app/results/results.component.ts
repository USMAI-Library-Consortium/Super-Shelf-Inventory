import {Component, OnDestroy, OnInit} from '@angular/core';
import {AlmaJobService} from "../alma-job.service";
import {ReportService} from "../report.service";
import {Subscription} from "rxjs";
import {ParseReportService} from "../parse-report.service";
import {Router} from "@angular/router";
import {filter} from "rxjs/operators";

@Component({
    selector: 'app-results',
    templateUrl: './results.component.html',
    styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, OnDestroy {

    reportDataSubscription: Subscription;

    constructor(public reportService: ReportService, private prs: ParseReportService, public ajs: AlmaJobService, private router: Router) {
    }

    ngOnInit(): void {}

    ngOnDestroy() {
        if (this.reportDataSubscription) this.reportDataSubscription.unsubscribe();
    }

    onSubmit() {
        this.reportService.reset()
        this.prs.reset()
        this.ajs.reset()
        this.router.navigate(['/'])
    }

    onBack() {
        this.reportService.reset()
        this.ajs.resetPostProcess()
        this.router.navigate(['/', "configure-report"])
    }

    downloadReport() {
        this.reportDataSubscription = this.reportService.getLatestReport().subscribe(
            result => {
                this.reportService.generateAndDownloadExcel(result)
            }
        )
    }
}
