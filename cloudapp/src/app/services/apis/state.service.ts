import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {CloudAppStoreService} from "@exlibris/exl-cloudapp-angular-lib";

import {AlmaJob} from "./export-job.service";
import {FileInfo} from "../fileParsing/barcode-parser.service";

export interface PreviousRun extends AlmaJob, FileInfo {}

@Injectable({
    providedIn: "root",
})
export class StateService {

    constructor(private storeService: CloudAppStoreService) {
    }

    private getState(): Observable<PreviousRun[]> {
        return this.storeService.get("history").pipe(map(history => {
            if (!history) return []
            return JSON.parse(history)
        }), map(previousRuns => {
            return this.cleanPreviousRuns(previousRuns)
        }))
    }

    public findSimilarRuns(
        inputFileName: string,
        numberOfRecords: number,
        firstBarcode: string
    ): Observable<PreviousRun | null> {
        return this.getState().pipe(map(previousRuns => {
            const previousRunsThatAreSimilar = previousRuns.filter((run) => {
                return firstBarcode === run.firstBarcode &&
                    numberOfRecords === run.numberOfRecords;
            });

            // Return the last run that has the same number of members and the same first barcode.
            console.log(`There are ${previousRunsThatAreSimilar.length} similar previous runs.`)
            return previousRunsThatAreSimilar.length > 0
                ? previousRunsThatAreSimilar.pop()!
                : null;
        }))
    }

    public saveRun(inputFileName: string, numberOfRecords: number, firstBarcode: string, jobDate: string, dataExtractUrl: string, jobId: string): Observable<any> {
        const runToSave: PreviousRun = {
            inputFileName,
            numberOfRecords,
            firstBarcode,
            jobId,
            dataExtractUrl,
            jobDate
        };

        return this.getState().pipe(map(previousRuns => {
            return [...previousRuns, runToSave]
        }), switchMap(newHistory => {
            return this.storeService.set("history", JSON.stringify(newHistory))
        }), tap(result => console.log(result)))
    }

    private cleanPreviousRuns(previousRuns: PreviousRun[]): PreviousRun[] {
        // Get the date two days ago so that we can remove cached dates before then.
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        return previousRuns.filter((run) => new Date(Number(run.jobDate)) > twoDaysAgo);
    }
}
