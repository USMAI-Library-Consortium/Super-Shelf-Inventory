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
  selector: "app-report-input",
  templateUrl: "./report-input.component.html",
  styleUrls: ["./report-input.component.scss"],
})
export class ReportInputComponent implements OnInit {
  reportForm: FormGroup;

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

  onSubmit() {
    this.router.navigate(["configure-report"])
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    this.prs.parseReport(input.files[0]);
  }
}
