import {Component, OnDestroy, OnInit} from '@angular/core';
import {ReportService} from "../report.service";
import {AlmaJobService} from "../alma-job.service";
import {Subscription} from "rxjs";
import {map} from "rxjs/operators";
import {Router} from "@angular/router";

@Component({
    selector: 'app-report-loading',
    templateUrl: './report-loading.component.html',
    styleUrls: ['./report-loading.component.scss']
})
export class ReportLoadingComponent implements OnInit, OnDestroy {
    getReportSubscription: Subscription
    postprocessCompleteSubscription: Subscription;
    userMessagesSubscription: Subscription;

    userMessages: string[] = []

    constructor(private reportService: ReportService, public ajs: AlmaJobService, private router: Router) {
    }

    ngOnInit(): void {
        this.ajs.userMessages$.subscribe(message => {
            this.userMessages.push(message)
        })
        this.postprocessCompleteSubscription = this.ajs.postprocessComplete$.subscribe(value => {
            this.router.navigate(["results"])
        })
        this.getReportSubscription = this.reportService.getlatestReport().pipe(map(report => {
            this.ajs.postprocess(report.markAsInventoriedField, report.scanInItems)
        })).subscribe()
    }

    ngOnDestroy(): void {
        if (this.getReportSubscription) this.getReportSubscription.unsubscribe();
        if (this.postprocessCompleteSubscription) this.postprocessCompleteSubscription.unsubscribe();
        if (this.userMessagesSubscription) this.userMessagesSubscription.unsubscribe();
    }

}
