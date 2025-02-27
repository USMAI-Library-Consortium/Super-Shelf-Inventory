import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {Router} from "@angular/router";

import {PostprocessService} from "../services/apis/postprocess.service";
import {PhysicalItemInfoService} from "../services/fileParsing/physical-item-info.service";
import {ReportService} from "../services/dataProcessing/report.service";
import {IndividualItemInfoService} from "../services/apis/individual-item-info.service";
import {BackupItemExportService} from "../services/apis/backup-item-export.service";

@Component({
    selector: 'app-results',
    templateUrl: './results.component.html',
    styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, OnDestroy {

    reportDataSubscription: Subscription;

    constructor(public reportService: ReportService,
                public postprocessService: PostprocessService,
                private prs: PhysicalItemInfoService,
                private iii: IndividualItemInfoService,
                private bes: BackupItemExportService,
                private router: Router) {
    }

    ngOnInit(): void {}

    ngOnDestroy() {
        if (this.reportDataSubscription) this.reportDataSubscription.unsubscribe();
    }

    onSubmit() {
        this.reportService.getLatestReport().subscribe(data => {
            this.reportService.reset()
            this.iii.reset()
            this.bes.reset()
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
