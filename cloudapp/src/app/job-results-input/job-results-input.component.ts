import { Component, OnDestroy, OnInit } from "@angular/core";
import {BehaviorSubject, Subscription} from "rxjs";
import {
  AlmaJobService,
  RunJobOutput,
} from "../alma-job.service";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ParseReportService } from "../parse-report.service";
import { Router } from "@angular/router";

@Component({
  selector: "app-job-results-input",
  templateUrl: "./job-results-input.component.html",
  styleUrls: ["./job-results-input.component.scss"],
})
export class JobResultsInputComponent implements OnInit, OnDestroy {
  reportForm: FormGroup;
  jobResultsSubscription: Subscription;
  parseReportSubscription: Subscription;

  ready$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(
      public ajs: AlmaJobService,
      public prs: ParseReportService,
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
    this.ajs.reset(false)
    this.router.navigate(["/"])
  }

  onSubmit() {
    this.router.navigate(["configure-report"])
  }

  onFileSelect(event: Event) {
    this.ready$.next(false)
    const input = event.target as HTMLInputElement;
    this.jobResultsSubscription = this.ajs.getJobResults().subscribe(result => {
      this.parseReportSubscription = this.prs.parseReport(input.files[0], result).subscribe(result => {
        this.ready$.next(true);
      });
    })
  }
}
