import {NgModule} from "@angular/core";
import {Routes, RouterModule} from "@angular/router";
import {BarcodeInputComponent} from "./barcode-input/barcode-input.component";
import {ReportForm} from "./report-form/report-form.component";
import {JobResultsInputComponent} from "./job-results-input/job-results-input.component";
import {AdministrationComponent} from "./administration/administration.component";
import {ResultsComponent} from "./results/results.component";

const routes: Routes = [
    {path: "", component: BarcodeInputComponent},
    {path: "job-results-input", component: JobResultsInputComponent},
    {path: "configure-report", component: ReportForm},
    {path: "administration", component: AdministrationComponent},
    {path: "results", component: ResultsComponent},
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true, onSameUrlNavigation: 'reload'})],
    exports: [RouterModule],
})
export class AppRoutingModule {
}
