import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule, CloudAppTranslateModule, AlertModule } from '@exlibris/exl-cloudapp-angular-lib';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { MainComponent } from './main/main.component';
import { ReportForm } from './report-form/report-form.component';
import { BarcodeInputComponent } from './barcode-input/barcode-input.component';
import { JobResultsInputComponent } from './job-results-input/job-results-input.component';
import { RunInfoComponent } from './run-info/run-info.component';
import { ResultsComponent } from './results/results.component';
import { AdministrationComponent } from './administration/administration.component';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    ReportForm,
    BarcodeInputComponent,
    JobResultsInputComponent,
    RunInfoComponent,
    ResultsComponent,
    AdministrationComponent,
  ],
  imports: [
    MaterialModule,
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    AlertModule,
    FormsModule,
    ReactiveFormsModule,     
    CloudAppTranslateModule.forRoot(),
  ],
  providers: [
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'standard' } },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
