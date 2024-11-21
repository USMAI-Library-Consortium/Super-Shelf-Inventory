import { Component, OnDestroy, OnInit } from "@angular/core";
import {BehaviorSubject, Subscription} from "rxjs";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ParseReportService } from "../services/fileParsing/parse-report.service";
import { Router } from "@angular/router";
import {ExportJobService} from "../services/apis/export-job.service";
import {BarcodeParserService} from "../services/fileParsing/barcode-parser.service";

@Component({
  selector: "app-job-results-input",
  templateUrl: "./job-results-input.component.html",
  styleUrls: ["./job-results-input.component.scss"],
})
export class JobResultsInputComponent implements OnInit, OnDestroy {
  public reportForm: FormGroup;
  public ready$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  private jobResultsSubscription: Subscription;
  private parseReportSubscription: Subscription;

  constructor(
      public prs: ParseReportService,
      public ejs: ExportJobService,
      private bps: BarcodeParserService,
      private fb: FormBuilder,
      private router: Router
  ) {}

  ngOnInit(): void {
    this.reportForm = this.fb.group({
      reportFormInput: [null, Validators.required],
    });
  }

  ngOnDestroy(): void {
    if(this.jobResultsSubscription) this.jobResultsSubscription.unsubscribe();
    if(this.parseReportSubscription) this.parseReportSubscription.unsubscribe();
  }

  onBack(): void {
    this.router.navigate(["/"])
  }

  onSubmit() {
    this.router.navigate(["configure-report"])
  }

  onFileSelect(event: Event) {
    this.ready$.next(false)
    const input = event.target as HTMLInputElement;
    this.jobResultsSubscription = this.bps.getLatestBarcodes().subscribe(barcodes => {
      this.parseReportSubscription = this.prs.parseReport(input.files[0], barcodes).subscribe(result => {
        this.ready$.next(true);
      });
    })
  }
}
