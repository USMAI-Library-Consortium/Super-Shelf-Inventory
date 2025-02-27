import { Injectable } from '@angular/core';
import {CloudAppRestService} from "@exlibris/exl-cloudapp-angular-lib";
import {BehaviorSubject, forkJoin, Observable, of} from "rxjs";
import {PhysicalItem} from "../fileParsing/physical-item-info.service";
import {catchError, map, retry, tap} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class BackupItemExportService {

  total = 0
  complete = 0

  constructor(private restService: CloudAppRestService) { }

  public pullItemData(barcodes: string[]): Observable<PhysicalItem[]> {
    this.total = barcodes.length
    const itemRequests = barcodes.map(barcode => {
      return this.getItemInfo(barcode).pipe(tap(_ => this.complete++))
    })

    return forkJoin(itemRequests)
  }

  private getItemInfo(barcode: string): Observable<PhysicalItem> {
    console.log(barcode)
    return this.restService.call(`/items?item_barcode=${barcode}`).pipe(map(result => {
      console.log(result);
      const item: PhysicalItem = {
        barcode,
        existsInAlma: true,
        source: 'api',
        title: result['bib_data']['title'],
        description: result['item_data']['description'],
        mmsId: result['bib_data']['mms_id'],
        holdingId: result['holding_data']['holding_id'],
        pid: result['item_data']['pid'],
        callNumber: result['holding_data']['call_number'],
        library: result['holding_data']['in_temp_location'] ? result['item_data']['temp_library']['value'] : result['item_data']['library']['value'],
        location: result['holding_data']['in_temp_location'] ? result['item_data']['temp_location']['value'] : result['item_data']['temp_location']['value'],
        policyType: result['item_data']['policy']['value'],
        itemMaterialType: result['item_data']['physical_material_type']['value'],
        status: result['item_data']['base_status'] == '0' ? "Item not in place" : "Item in place",
        processType: result['item_data']['process_type'],
        lastModifiedDate: result['item_data']['modification_date'],
        inTempLocation: result['holding_data']['in_temp_location'],
        hasTempLocation: null,
        requested: result['item_data']['requested'],
      }
      return item
    }), catchError(err => {
      console.log(`API Error: ${err}`)
      const item: PhysicalItem = {
        barcode,
        existsInAlma: false,
        source: 'api',
        title: null,
        description: null,
        mmsId: null,
        holdingId: null,
        pid: null,
        callNumber: null,
        library: null,
        location: null,
        policyType: null,
        itemMaterialType: null,
        status: null,
        processType: null,
        lastModifiedDate: null,
        inTempLocation: null,
        hasTempLocation: null,
        requested: null
      }
      return of(item)
    }))
  }
}
