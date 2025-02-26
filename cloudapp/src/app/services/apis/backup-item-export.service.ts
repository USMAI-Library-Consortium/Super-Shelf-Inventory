import { Injectable } from '@angular/core';
import {CloudAppRestService} from "@exlibris/exl-cloudapp-angular-lib";
import {forkJoin, Observable} from "rxjs";
import {PhysicalItem} from "../fileParsing/physical-item-info.service";
import {catchError, retry} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class BackupItemExportService {

  constructor(private restService: CloudAppRestService) { }

  // public pullItemData(barcodes: string[]): Observable<PhysicalItem[]> {
  //   const itemRequests = barcodes.map(barcode => {
  //     return this.restService.call(`items?item_barcode=${barcode}`).pipe(retry(1), catchError(err => {
  //       return barcode
  //     }))
  //   })
  //
  //   forkJoin(itemRequests).pipe()
  // }
}
