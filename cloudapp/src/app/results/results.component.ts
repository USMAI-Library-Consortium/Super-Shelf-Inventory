import {Component, OnDestroy, OnInit} from '@angular/core';
import {AlmaJobService} from "../alma-job.service";
import {ReportService} from "../report.service";
import {Subscription} from "rxjs";

@Component({
  selector: 'app-results',
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, OnDestroy {

  reportDataSubscription: Subscription;

  constructor(private ajs: AlmaJobService, public reportService: ReportService) { }

  ngOnInit(): void {

  }

  ngOnDestroy() {
    if (this.reportDataSubscription) this.reportDataSubscription.unsubscribe();
  }

  onSubmit() {

  }

  onBack() {

  }

  downloadReport() {
    this.reportDataSubscription = this.reportService.getlatestReport().subscribe(
        result => {
          this.reportService.generateExcel(result)
        }
    )
  }
}
