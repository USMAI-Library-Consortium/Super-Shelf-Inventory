import {Injectable} from '@angular/core';
import {catchError, filter, map, retry, switchMap, take, tap} from "rxjs/operators";
import {BehaviorSubject, forkJoin, Observable, of, Subject} from "rxjs";
import {AlertService, CloudAppRestService, HttpMethod} from "@exlibris/exl-cloudapp-angular-lib";


export interface AlmaSet {
    id: number;
    name: string;
}

interface AddMembersToSetProgress {
    totalMembers: number;
    membersAdded: number;
}

@Injectable({
    providedIn: 'root'
})
export class SetService {
    // Observables to display progress to user
    public createBaseSetProgress$: Subject<string> = new Subject()
    public addMembersToSetProgress$: Subject<AddMembersToSetProgress> = new Subject()
    public addMembersToSetDone$: Subject<Boolean> = new Subject()

    private setInfo$: BehaviorSubject<AlmaSet | null> = new BehaviorSubject(null);

    constructor(private restService: CloudAppRestService, private alert: AlertService) {
    }

    public createSet(barcodes: string[]): Observable<AlmaSet | null> {
        return this.createBaseSet().pipe(switchMap(set => {
            return this.addMembersToSet(set, barcodes).pipe(tap(result => {
                this.setInfo$.next(result)
            }))
        }))
    }

    public reset() {
        this.setInfo$.next(null)
    }

    public getLatestSetInfoOrCreateSet(barcodes: string[]): Observable<AlmaSet> {
        return this.setInfo$.pipe(switchMap(set => {
            if (!set) {
                return this.createSet(barcodes)
            } else {
                return of(set)
            }
        }))
    }

    public getLatestSetInfo() {
        return this.setInfo$.pipe(filter(result => {
            return !!result
        }), take(1))

    }

    private createBaseSet(): Observable<AlmaSet> {
        this.createBaseSetProgress$.next("Started...")
        const {setName, newSet} = this.generateBaseSetBody();

        return this.restService.call({
            url: "/conf/sets",
            method: HttpMethod.POST,
            requestBody: newSet,
        }).pipe(map(result => {
            return {
                id: result["id"],
                name: setName
            }
        }), tap(set => {
            this.createBaseSetProgress$.next(`Set '${set.name}' created.`)
        }))
    }

    protected generateBaseSetBody(currentDate: Date = new Date()) {
        const timestamp = `${
            currentDate.getMonth() + 1
        }-${currentDate.getDate()}-${currentDate.getFullYear()} ${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}`;
        const setName = `inventory_app ${timestamp}`;

        const newSet = {
            link: "",
            name: setName,
            description: "Set of physical items.",
            content: {
                value: "ITEM",
            },
            type: {
                value: "ITEMIZED",
            },
            private: {
                value: "true",
            },
        };
        return {setName, newSet};
    }

    private addMembersToSet(setInfo: AlmaSet, barcodes: string[]): Observable<AlmaSet | null> {
        const addSetMemberBodies = this.generateAddMembersBodies(barcodes);

        const addMemberToSetJobs = addSetMemberBodies.map(body => {
            let membersAdded = 0
            return this.restService.call({
                url: `/conf/sets/${setInfo.id}?op=add_members&fail_on_invalid_id=false&id_type=BARCODE`,
                method: HttpMethod.POST,
                requestBody: body,
            }).pipe(retry(1), catchError(e => {
                this.alert.error("Could not add some members to set.")
                console.log(e)
                return of(false)
            }), map(result => {
                if (result) {
                    console.log(result)
                    membersAdded += result["number_of_members"]["value"]
                    this.addMembersToSetProgress$.next({
                        totalMembers: barcodes.length,
                        membersAdded: membersAdded,
                    })
                    return true
                } else {
                    return false
                }
            }))
        })

        return forkJoin(addMemberToSetJobs).pipe(map(results => {
            let successful = true
            results.forEach(result => {
                if (!result) successful = false
            })
            this.addMembersToSetDone$.next(true)
            if (successful) return setInfo
            else return null
        }))
    }

    protected generateAddMembersBodies(barcodes: string[]) {
        const maxChunkSize = 500;
        const barcodeChunks: string[][] = [];

        barcodes.forEach((barcode, i) => {
            if (i % maxChunkSize === 0) {
                barcodeChunks.push([]);
            }
            barcodeChunks[barcodeChunks.length - 1].push(barcode);
        });

        return barcodeChunks.map(barcodeChunk => {
            return {
                members: {
                    total_record_count: barcodeChunk.length,
                    member: barcodeChunk.map((barcode) => {
                        return {
                            link: "",
                            id: barcode,
                        };
                    }),
                },
            };
        });
    }

    private deleteSet(setInfo: AlmaSet) {
        return this.restService
            .call({
                url: `/conf/sets/${setInfo.id}`,
                method: HttpMethod.DELETE,
                headers: {
                    Accept: "application/json",
                },
            });
    }
}
