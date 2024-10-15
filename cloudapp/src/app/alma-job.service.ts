import {Injectable} from "@angular/core";
import {AlertService, CloudAppRestService, HttpMethod,} from "@exlibris/exl-cloudapp-angular-lib";
import * as XLSX from "xlsx";
import {from, ReplaySubject, Subject} from "rxjs";
import {StateService} from "./state.service";
import {filter} from "rxjs/operators";

export interface RunJobOutput {
    barcodes: string[]
    setId: string;
    setName: string;
    reportIdentifier: string;
    date: string;
}

@Injectable({
    providedIn: "root",
})
export class AlmaJobService {
    // Input barcode file
    excelFile: Blob;

    // Data that this services parses and stores
    public fileName: string;
    private setId: string = null;
    private setName: string = null;
    private reportIdentifier: string = null;
    barcodes: string[] = null;

    // To aid with external logic.
    loadComplete$: ReplaySubject<RunJobOutput | null> = new ReplaySubject(1)
    userMessages$: Subject<string> = new Subject();

    constructor(
        private restService: CloudAppRestService,
        private alert: AlertService,
        private stateService: StateService
    ) {
        // Save the run information once it's done.
        this.loadComplete$.subscribe((runInfo) => {
            if (runInfo) {
                this.stateService
                    .saveRun(this.fileName, runInfo.barcodes.length, runInfo[0], runInfo.reportIdentifier, runInfo.date)
                    .subscribe(() => {
                        this.userMessages$.next("Run Information Saved.");
                    }, () => {
                        this.userMessages$.next("RUN INFO NOT SAVED.");
                        this.alert.error("Run information could not be saved.")
                    });
            }
        })
    }

    public getJobResults() {
        return this.loadComplete$.pipe(filter(runJobOutput => runJobOutput !== null))
    }

    private checkJobProgress () {
        setTimeout(() => {
            this.restService
                .call({
                    url: this.reportIdentifier,
                    headers: {
                        Accept: "application/json",
                    },
                })
                .subscribe((result) => {
                    if (result["progress"] === 100 || result["progress"] == "100") {
                        this.loadComplete$.next({
                            setId: this.setId,
                            setName: this.setName,
                            reportIdentifier: this.reportIdentifier,
                            barcodes: this.barcodes,
                            date: this.stateService.stringifyDate(new Date())
                        })
                    } else {
                        this.userMessages$.next(`Job progress is ${result["progress"]}%`);
                        this.checkJobProgress();
                    }
                });
        }, 3000);
    }

    public loadData(input: any): void {
        this.loadComplete$.next(null);
        if (input.hasOwnProperty("date")) {
            // This run has been completed previously
            this.loadComplete$.next({
                barcodes: this.barcodes,
                date: input.date,
                reportIdentifier: input.reportIdentifier,
                setId: "",
                setName: "",
            });
        } else {
            this.createSet();
        }
    }

    private runJobOnSet() {
        this.restService
            .call({
                url: "/conf/jobs/M48?op=run",
                method: HttpMethod.POST,
                headers: {
                    "Content-Type": "application/xml",
                    Accept: "application/json",
                },
                requestBody: `<job>
        <parameters>
          <parameter>
            <name>task_ExportParams_outputFormat_string</name>
            <value>CSV</value>
          </parameter>
          <parameter>
            <name>task_ExportParams_exportFolder_string</name>
            <value>PRIVATE</value>
          </parameter>
          <parameter>
            <name>task_ExportParams_ftpConfig_string</name>
            <value></value>
          </parameter>
          <parameter>
            <name>task_ExportParams_ftpSubdirectory_string</name>
            <value></value>
          </parameter>
          <parameter>
            <name>set_id</name>
            <value>${this.setId}</value>
          </parameter>
          <parameter>
            <name>job_name</name>
            <value>${this.setName}</value>
          </parameter>
        </parameters>
      </job>
      `,
            })
            .subscribe((result) => {
                console.log(result);
                this.userMessages$.next(
                    `Job with ID ${(result["additional_info"]["link"] as string).replace(
                        "/almaws/v1/conf/jobs/M48/instances/",
                        ""
                    )} started.`
                );

                this.reportIdentifier = (result["additional_info"]["link"] as string).replace("/almaws/v1", "")
                this.checkJobProgress()
            });
    }

    private createSet(): void {
        const currentDate = new Date();
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

        const newSetMembers = {
            members: {
                total_record_count: this.barcodes.length,
                member: this.barcodes.map((barcode) => {
                    return {
                        link: "",
                        id: barcode,
                    };
                }),
            },
        };

        console.log("Creating set...");
        this.restService
            .call({
                url: "/conf/sets",
                method: HttpMethod.POST,
                requestBody: newSet,
            })
            .subscribe((result) => {
                this.userMessages$.next("Created set.");
                console.log(`Created set with id ${result.id}`);
                console.log("Adding members set, please wait up to a minute...");
                this.restService
                    .call({
                        url: `/conf/sets/${result["id"]}?op=add_members&fail_on_invalid_id=false&id_type=BARCODE`,
                        method: HttpMethod.POST,
                        requestBody: newSetMembers,
                    })
                    .subscribe((result) => {
                        this.setId = result["id"];
                        this.setName = setName;
                        this.userMessages$.next("Added members to set.");
                        console.log(
                            `Added ${result["number_of_members"]["value"]} members to the set`
                        );

                        this.runJobOnSet()
                    });
            });
    }

    private deleteSet() {
        return this.restService
            .call({
                url: `/conf/sets/${this.setId}`,
                method: HttpMethod.DELETE,
                headers: {
                    Accept: "application/json",
                },
            });
    }

    public parseExcelFile() {
        this.loadComplete$.next(null)

        return from(
            this.excelFile.arrayBuffer().then(
                (data) => {
                    const items: string[] = [];
                    const workbook = XLSX.read(data, {
                        type: "binary",
                    });

                    const firstSheetName = workbook.SheetNames[0];
                    const rows: any[] = XLSX.utils.sheet_to_json(
                        workbook.Sheets[firstSheetName]
                    );
                    rows.forEach((row) => {
                        let barcode: string = null;
                        if ("barcode" in row) {
                            barcode = row["barcode"];
                        } else if ("Barcode" in row) {
                            barcode = row["Barcode"];
                        } else if ("BARCODE" in row) {
                            barcode = row["BARCODE"];
                        } else {
                            this.alert.error(`No barcode column in file; found columns ${Object.keys(row).join(", ")}`);
                            throw Error("Invalid Document.");
                        }

                        if (barcode) {
                            items.push(barcode);
                        }
                    });

                    this.userMessages$.next("Parsed Excel File successfully...");
                    console.log(`${items.length} items parsed from excel file.`);
                    this.barcodes = items;
                    return this.barcodes;
                },
                (reason) => {
                    this.alert.error("Error in parsing excel file. Ensure it is valid.");
                }
            )
        );
    }
}
