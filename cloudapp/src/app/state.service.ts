import {Injectable} from "@angular/core";
import {CloudAppStoreService} from "@exlibris/exl-cloudapp-angular-lib";
import {Observable, ReplaySubject} from "rxjs";
import {map} from "rxjs/operators";

export interface RunInput {
  inputFileName: string;
  numberOfRecords: number;
  firstBarcode: string;
}

export interface PreviousRunInput extends RunInput {
  dataExtractUrl: string;
}

export interface PreviousRun extends PreviousRunInput {
  date: string;
}

@Injectable({
  providedIn: "root",
})
export class StateService {
  private previousRuns: PreviousRun[] = null

  // Simply emits when the state service is ready. Once initialized it should be ready for
  // the whole time the user is using the application - it should not need to be reset.
  private loadComplete: ReplaySubject<void> = new ReplaySubject<void>(1);

  constructor(private storeService: CloudAppStoreService) {
    this.getState();
  }

  public getState() {
    this.storeService.get("history").subscribe((history) => {
      try {
        if (history == null || history == "1") {
          this.storeService
              .set("history", JSON.stringify([]))
              .subscribe((result) => {
                this.previousRuns = [];
                this.loadComplete.next()
              });
        } else {
          console.log(history)
          const cleanedRuns = this.cleanPreviousRuns(JSON.parse(history))
          console.log(`History contains ${cleanedRuns.length} elements`);
          this.previousRuns = cleanedRuns;
          this.loadComplete.next()
        }
      } catch (error) {
        this.loadComplete.error(error)
      }
    });
  }

  public checkIfCachedResults(newRun: RunInput): Observable<PreviousRun | null> {
    return this.loadComplete.pipe(
        map((successful) => {
          const previousRunsThatAreSimilar = this.previousRuns.filter((run) => {
            return newRun.firstBarcode === run.firstBarcode &&
                newRun.numberOfRecords === run.numberOfRecords;
          });

          // Return the last run that has the same number of members and the same first barcode.
          console.log(`There are ${previousRunsThatAreSimilar.length} similar previous runs.`)
          return previousRunsThatAreSimilar.length > 0
              ? previousRunsThatAreSimilar.pop()
              : null;
        }),
    );
  }

  public saveRun(inputFileName: string, numberOfRecords: number, firstBarcode: string, dataExtractUrl: string, date: string): Observable<void> {
    const runToSave: PreviousRun = {
      inputFileName,
      numberOfRecords,
      firstBarcode,
      dataExtractUrl: dataExtractUrl,
      date
    };

    this.previousRuns = [...this.previousRuns, runToSave]
    return this.storeService.set("history", JSON.stringify(this.previousRuns)).pipe(map(results => void 0))
  }

  private cleanPreviousRuns(previousRuns: PreviousRun[]): PreviousRun[] {
    // Get the date two days ago so that we can remove cached dates before then.
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    return previousRuns.filter((run) => this.parseDate(run.date) > twoDaysAgo);
  }

  stringifyDate(date: Date): string {
    return date.getTime().toString();
  }

  private parseDate(dateString: string): Date {
    return new Date(Number(dateString));
  }
}
