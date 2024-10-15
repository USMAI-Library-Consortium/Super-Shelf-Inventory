import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { BarcodeInputComponent } from "./barcode-input/barcode-input.component";
import { InputformComponent } from "./inputform/inputform.component";
import { LoadingScreenComponent } from "./loading-screen/loading-screen.component";
import { ReportInputComponent } from "./report-input/report-input.component";

const routes: Routes = [
  { path: "", component: BarcodeInputComponent },
  { path: "loading", component: LoadingScreenComponent },
  { path: "report-input", component: ReportInputComponent},
  { path: "configure-report", component: InputformComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
