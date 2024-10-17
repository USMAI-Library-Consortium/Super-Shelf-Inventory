import {NgModule} from "@angular/core";
import {Routes, RouterModule} from "@angular/router";
import {BarcodeInputComponent} from "./barcode-input/barcode-input.component";
import {ReportForm} from "./report-form/report-form.component";
import {LoadingScreenComponent} from "./loading-screen/loading-screen.component";
import {JobResultsInputComponent} from "./job-results-input/job-results-input.component";
import {AdministrationComponent} from "./administration/administration.component";

const routes: Routes = [
    {path: "", component: BarcodeInputComponent},
    {path: "loading", component: LoadingScreenComponent},
    {path: "job-results-input", component: JobResultsInputComponent},
    {path: "configure-report", component: ReportForm},
    {path: "administration", component: AdministrationComponent}
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true})],
    exports: [RouterModule],
})
export class AppRoutingModule {
}
