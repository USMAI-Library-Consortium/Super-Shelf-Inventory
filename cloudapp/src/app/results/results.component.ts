import {Component, OnDestroy, OnInit} from '@angular/core';
import {ReportService} from "../services/dataProcessing/report.service";
import {Subscription} from "rxjs";
import {ParseReportService} from "../services/fileParsing/parse-report.service";
import {Router} from "@angular/router";
import {PostprocessService} from "../services/apis/postprocess.service";

@Component({
    selector: 'app-results',
    templateUrl: './results.component.html',
    styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, OnDestroy {

    reportDataSubscription: Subscription;

    constructor(public reportService: ReportService, public postprocessService: PostprocessService, private prs: ParseReportService, private router: Router) {
    }

    ngOnInit(): void {}

    ngOnDestroy() {
        if (this.reportDataSubscription) this.reportDataSubscription.unsubscribe();
    }

    onSubmit() {
        this.reportService.getLatestReport().subscribe(data => {
            this.reportService.reset()
            this.prs.reset()
            this.postprocessService.reset()
            this.router.navigate(['/'])
        })
    }

    onBack() {
        this.reportService.reset()
        this.postprocessService.reset()
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
