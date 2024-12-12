import {Injectable} from '@angular/core';
import {CloudAppRestService} from "@exlibris/exl-cloudapp-angular-lib";
import {BehaviorSubject, from, Observable, of, Subject} from "rxjs";
import {PhysicalItem} from "../fileParsing/parse-report.service";
import {filter, map, mergeMap, take, tap, toArray} from "rxjs/operators";

interface IndividualItemInfoProgress {
    completed: number,
    total: number
}

@Injectable({
    providedIn: 'root'
})
export class IndividualItemInfoService {
    public getIndividualItemInfoProgress$ = new Subject<IndividualItemInfoProgress>();
    private itemInfoProcessed$ = new BehaviorSubject<PhysicalItem[]>(null)

    constructor(private restService: CloudAppRestService) {
    }

    public getLatestPhysicalItemInfo(): Observable<PhysicalItem[]> {
        return this.itemInfoProcessed$.pipe(filter(itemInfo => !!itemInfo), take(1))
    }

    private fetchTempLocationInfo(item: PhysicalItem): Observable<PhysicalItem> {
        return this.restService.call(`/bibs/${item.mmsId}/holdings/${item.holdingId}/items/${item.pid}`).pipe(map(result => {
            console.log(result);
            const itemWithNewInfo = {...item}
            itemWithNewInfo.inTempLocation = result['holding_data']['in_temp_location']
            if (itemWithNewInfo.inTempLocation) {
                itemWithNewInfo.library = result['holding_data']['temp_library']['value']
                itemWithNewInfo.location = result['holding_data']['temp_location']['value'] ? result['holding_data']['temp_location']['value'] : itemWithNewInfo.library
                itemWithNewInfo.callNumber = result['holding_data']['temp_call_number'] ? result['holding_data']['temp_call_number'] : itemWithNewInfo.callNumber
                itemWithNewInfo.policyType = result['holding_data']['temp_policy']['value'] ? result['holding_data']['temp_policy']['value'] : itemWithNewInfo.policyType
            }
            return itemWithNewInfo
        }))
    }

    public pullTempLocationItemInfo(items: PhysicalItem[]): Observable<PhysicalItem[]> {
        const total = items.filter(item => item.hasTempLocation).length
        let completed = 0
        return from(items).pipe(mergeMap(item => {
            return item.hasTempLocation ? this.fetchTempLocationInfo(item).pipe(tap(item => completed += 1), tap(item => {
                this.getIndividualItemInfoProgress$.next({
                    completed,
                    total
                })
            })) : of(item)
        }), toArray(), tap(items => this.itemInfoProcessed$.next(items)))
    }

    public reset() {
        this.itemInfoProcessed$.next(null)
    }
}
