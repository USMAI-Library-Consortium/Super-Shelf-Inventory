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
      return this.extractItemDataFromAPIResponse(barcode, result)
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

  public extractItemDataFromAPIResponse(barcode: string, response: object): PhysicalItem {
    return {
      barcode,
      existsInAlma: true,
      source: 'api',
      title: response['bib_data']['title'],
      description: response['item_data']['description'],
      mmsId: response['bib_data']['mms_id'],
      holdingId: response['holding_data']['holding_id'],
      pid: response['item_data']['pid'],
      callNumber: response['holding_data']['call_number'],
      library: response['holding_data']['in_temp_location'] ? response['holding_data']['temp_library']['value'] : response['item_data']['library']['value'],
      location: response['holding_data']['in_temp_location'] ? response['holding_data']['temp_location']['value'] : response['item_data']['location']['value'],
      policyType: response['item_data']['policy']['value'],
      itemMaterialType: response['item_data']['physical_material_type']['value'],
      status: response['item_data']['base_status'] == '0' ? "Item not in place" : "Item in place",
      processType: response['item_data']['process_type'],
      lastModifiedDate: response['item_data']['modification_date'],
      inTempLocation: response['holding_data']['in_temp_location'],
      hasTempLocation: null,
      requested: response['item_data']['requested'],
    }
  }
}
