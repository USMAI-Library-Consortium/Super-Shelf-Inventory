import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
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
  jobResultsSub: Subscription;

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

    this.jobResultsSub = this.ajs.loadComplete$.subscribe((result) => {
      console.log(result);
    })
  }

  ngOnDestroy(): void {
    this.jobResultsSub.unsubscribe();
  }

  onBack(): void {
    this.ajs.reset()
    this.router.navigate(["/"])
  }

  onSubmit() {
    this.router.navigate(["configure-report"])
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    this.prs.parseReport(input.files[0]);
  }
}
