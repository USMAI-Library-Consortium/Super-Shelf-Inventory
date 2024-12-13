import {Subscription, combineLatest, BehaviorSubject, Observable, of} from "rxjs";
import {Component, OnDestroy, OnInit} from "@angular/core";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {map, switchMap} from "rxjs/operators";
import {Router} from "@angular/router";
import {CloudAppConfigService, CloudAppRestService} from "@exlibris/exl-cloudapp-angular-lib";

import {SetService} from "../services/apis/set.service";
import {PostprocessService} from "../services/apis/postprocess.service";
import {ParseReportService} from "../services/fileParsing/parse-report.service";
import {BarcodeParserService} from "../services/fileParsing/barcode-parser.service";
import {ReportService} from "../services/dataProcessing/report.service";
import {IndividualItemInfoService} from "../services/apis/individual-item-info.service";

interface Library {
    name: string;
    code: string;
    count: number;
}

interface ScanLocation {
    name: string;
    code: string;
    count: number;
}

interface CircDesk {
    name: string;
    code: string;
}

interface ItemType {
    code: string;
    count: number;
}

interface PolicyType {
    code: string;
    count: number;
}

@Component({
    selector: "app-report-form",
    templateUrl: "./report-form.component.html",
    styleUrls: ["./report-form.component.scss"],
})
export class ReportForm implements OnInit, OnDestroy {
    public inventoryForm: FormGroup;

    public institutionLibraries: Library[] = [];
    public scanLocations: ScanLocation[] = [];
    public itemTypes: ItemType[] = [];
    public policyTypes: PolicyType[] = [];
    public circDesks: CircDesk[] = [];

    public reportLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    private filteredScanLocations: ScanLocation[] = [];

    private reportCompleteSubscription: Subscription
    private libraryCodeSubscription: Subscription;
    private physicalItemsSubscription: Subscription
    private postprocessSubscription: Subscription
    private locationSubscription: Subscription;
    private circDeskSubscription: Subscription;
    private reportLoadingSubscription: Subscription;

    private markAsInventoriedField: string | null = null;
    private libraryDict: { [key: string]: number } = {};
    private locationDict: { [key: string]: number } = {};
    private itemTypeDict: { [key: string]: number } = {};
    private policyTypeDict: { [key: string]: number } = {};

    constructor(
        private restService: CloudAppRestService,
        private fb: FormBuilder,
        private bps: BarcodeParserService,
        private prs: ParseReportService,
        private iii: IndividualItemInfoService,
        private reportService: ReportService,
        public setService: SetService,
        public postProcessService: PostprocessService,
        private router: Router,
        private configurationService: CloudAppConfigService,
    ) {
    }

    ngOnInit() {
        this.inventoryForm = this.fb.group({
            callNumberType: ["", Validators.required],
            library: ["", Validators.required],
            scanLocations: [[], Validators.required],
            expectedItemTypes: [[], Validators.required],
            expectedPolicyTypes: [[], Validators.required],
            limitOrderProblems: ["no", Validators.required],
            reportOnlyProblems: [false, Validators.required],
            sortBy: ["actualOrder", Validators.required],
            sortSerialsByDescription: [false, Validators.required],
            markAsInventoried: [false, Validators.required],
            scanInItems: [false, Validators.required],
            circDesk: [null],
        });

        this.inventoryForm.get("markAsInventoried").disable()
        this.inventoryForm.get("scanInItems").disable()
        this.inventoryForm.get("circDesk").disable()

        this.inventoryForm.get("scanInItems").valueChanges.subscribe(scanIn => {
            const circDeskInput = this.inventoryForm.get("circDesk");
            if (scanIn) {
                circDeskInput.enable()
                circDeskInput.setValidators([Validators.required])
            } else {
                circDeskInput.clearValidators()
                circDeskInput.disable()
                circDeskInput.setValue(null)
            }
            circDeskInput.updateValueAndValidity()
        })

        this.postprocessSubscription = this.configurationService.get().subscribe(values => {
            if (!values) {
                console.log("Postprocess Not Configured - using defaults (disabled)")
            } else {
                if (values["inventoryField"] !== 'None' && values["inventoryField"] !== "undefined") {
                    this.inventoryForm.get("markAsInventoried").enable()
                    this.markAsInventoriedField = values["inventoryField"];
                    console.log(`Marking Inventory Enabled - stored in ${values["inventoryField"]}`)
                } else {
                    this.markAsInventoriedField = null
                }
                if (values["allowScanIn"]) {
                    this.inventoryForm.get("scanInItems").enable()
                    console.log(`Scanning In Items Enabled.`)
                }

            }
        })

        // Watch for changes to the library to pull the locations for that library
        this.libraryCodeSubscription = this.inventoryForm
            .get("library")
            .valueChanges.subscribe((newLibraryCode) => {
                this.scanLocations = [];
                this.onSelectNewLibrary(newLibraryCode);
            });

        // Get the available libraries
        this.restService
            .call("/almaws/v1/conf/libraries")
            .subscribe((libraryResponse) => {
                this.institutionLibraries = this.parseLibraries(libraryResponse);
                if (this.institutionLibraries[0].count > 0)
                    this.inventoryForm.controls["library"].setValue(
                        this.institutionLibraries[0].code
                    );

                // // Get the selected library
                // this.eventsService.getInitData().subscribe(initData => {
                //   console.log("At library", initData.user.currentlyAtLibCode)
                //   this.inventoryForm.controls["library"].setValue(initData.user.currentlyAtLibCode)
                // })
            });

        this.physicalItemsSubscription = this.iii.getLatestPhysicalItemInfo().subscribe(physicalItems => {
            physicalItems.forEach((physicalItem) => {
                if (physicalItem.library) {
                    if (this.libraryDict.hasOwnProperty(physicalItem.library)) {
                        this.libraryDict[physicalItem.library] += 1;
                    } else {
                        this.libraryDict[physicalItem.library] = 1;
                    }
                }

                if (physicalItem.location) {
                    if (this.locationDict.hasOwnProperty(physicalItem.location)) {
                        this.locationDict[physicalItem.location] += 1;
                    } else {
                        this.locationDict[physicalItem.location] = 1;
                    }
                }

                if (physicalItem.itemMaterialType) {
                    if (this.itemTypeDict.hasOwnProperty(physicalItem.itemMaterialType)) {
                        this.itemTypeDict[physicalItem.itemMaterialType] += 1;
                    } else {
                        this.itemTypeDict[physicalItem.itemMaterialType] = 1;
                    }
                }

                if (physicalItem.policyType) {
                    if (this.policyTypeDict.hasOwnProperty(physicalItem.policyType)) {
                        this.policyTypeDict[physicalItem.policyType] += 1;
                    } else {
                        this.policyTypeDict[physicalItem.policyType] = 1;
                    }
                }
            });
            // Set the default item type - the one with the highest number of items
            this.itemTypes = Object.entries(this.itemTypeDict).map(([code, count]) => {
                return {code, count};
            });
            this.itemTypes.sort((a, b) => {
                return b.count - a.count;
            });
            this.itemTypes.forEach(itemType => {
                if (itemType.count >= 10) {
                    (<string[]>this.inventoryForm.controls["expectedItemTypes"].value).push(`${itemType.code}`)
                }
            })

            // Set the default policy type - the one with the highest number of items
            this.policyTypes = Object.entries(this.policyTypeDict).map(
                ([code, count]) => {
                    return {code, count};
                }
            );
            this.policyTypes.sort((a, b) => {
                return b.count - a.count;
            });
            this.policyTypes.forEach(policyType => {
                if (policyType.count >= 10) {
                    (<string[]>this.inventoryForm.controls["expectedPolicyTypes"].value).push(`${policyType.code}`)
                }
            })
        })
    }

    ngOnDestroy(): void {
        this.libraryCodeSubscription.unsubscribe();
        if (this.reportCompleteSubscription) this.reportCompleteSubscription.unsubscribe()
        if (this.circDeskSubscription) this.circDeskSubscription.unsubscribe()
        if (this.locationSubscription) this.locationSubscription.unsubscribe()
        if (this.reportLoadingSubscription) this.reportLoadingSubscription.unsubscribe()
        this.physicalItemsSubscription.unsubscribe()
        this.postprocessSubscription.unsubscribe()
    }

    public onBack(): void {
        this.prs.reset()
        this.iii.reset()
        this.reportService.reset()
        this.router.navigate(['/', 'job-results-input'])
    }

    public onSubmit() {
        this.reportLoading$.next(true)
        if (this.reportCompleteSubscription) this.reportCompleteSubscription.unsubscribe()
        const callNumberType = this.inventoryForm.get("callNumberType").value
        const library = this.inventoryForm.get("library").value
        const scanLocations = this.inventoryForm.get("scanLocations").value
        const circDesk = this.inventoryForm.get("circDesk").value
        const expectedItemTypes = this.inventoryForm.get("expectedItemTypes").value
        const expectedPolicyTypes = this.inventoryForm.get("expectedPolicyTypes").value
        const limitOrderProblems = this.inventoryForm.get("limitOrderProblems").value
        const reportOnlyProblems = this.inventoryForm.get("reportOnlyProblems").value
        const sortBy = this.inventoryForm.get("sortBy").value
        const sortSerialsByDescription = this.inventoryForm.get("sortSerialsByDescription").value
        const markAsInventoried = this.inventoryForm.get("markAsInventoried").value && this.inventoryForm.get("markAsInventoried").value !== "undefined" ? this.markAsInventoriedField : null
        const scanInItems = this.inventoryForm.get("scanInItems").value

        this.reportLoadingSubscription = combineLatest([this.bps.getLatestScanDate(), this.iii.getLatestPhysicalItemInfo()]).pipe(map(values => {
            return {
                scanDate: values[0],
                physicalItems: values[1],
            }
        })).pipe(switchMap(data => {
            return this.reportService.generateReport(callNumberType, library, scanLocations, expectedItemTypes, expectedPolicyTypes, limitOrderProblems, reportOnlyProblems, sortBy, sortSerialsByDescription, circDesk, data.scanDate, data.physicalItems).pipe(map(reportData => {
                console.log(" Done generating report ")
                return {
                    ...reportData,
                    scanDate: data.scanDate,
                }
            }))
        }), switchMap(reportData => {
            const postProcessJobs: Observable<any>[] = []
            console.log(markAsInventoried, scanInItems)
            if (markAsInventoried) {
                const barcodes: string[] = reportData.unsortedItems.map(item => item.barcode)
                const markAsInventoriedProcess = this.setService.getLatestSetInfoOrCreateSet(barcodes).pipe(switchMap(setInfo => {
                    return this.postProcessService.markAsInventoried(markAsInventoried, reportData.scanDate, setInfo)
                }))
                postProcessJobs.push(markAsInventoriedProcess)
            }
            if (scanInItems) postProcessJobs.push(this.postProcessService.scanInItems(reportData.unsortedItems, library, circDesk))

            return postProcessJobs.length > 0 ? combineLatest(postProcessJobs) : of([])
        })).subscribe(_ => {
            this.router.navigate(['results'])
        })
    }

    public onSelectNewLibrary(libraryCode: string) {
        this.filteredScanLocations = []
        this.scanLocations = []
        this.circDesks = []
        this.locationSubscription = this.restService
            .call(`/almaws/v1/conf/libraries/${libraryCode}/locations`)
            .subscribe((locationsData) => {
                locationsData.location.forEach((location) => {
                    let count = 0;
                    if (this.locationDict.hasOwnProperty(location.code))
                        count = this.locationDict[location.code];
                    this.scanLocations.push({
                        name: location.name,
                        code: location.code,
                        count,
                    });
                    this.filteredScanLocations = this.scanLocations.slice();
                    this.filteredScanLocations.sort((a, b) => {
                        return b.count - a.count;
                    });
                    if (this.filteredScanLocations[0].count > 0)
                        this.inventoryForm.controls["scanLocations"].setValue(
                            [this.filteredScanLocations[0].code]
                        );
                });
            });

        this.circDeskSubscription = this.restService.call(`/almaws/v1/conf/libraries/${libraryCode}/circ-desks`).subscribe(circDesksData => {
            console.log(circDesksData)
            circDesksData.circ_desk.forEach((circDesk) => {
                this.circDesks.push({
                    code: circDesk.code,
                    name: circDesk.name
                });
            })
        })
    }

    private parseLibraries(libraryJson: any | undefined): Library[] {
        const libraries: Library[] = [];

        libraryJson.library.forEach((library) => {
            let count = 0;
            if (this.libraryDict.hasOwnProperty(library.code))
                count = this.libraryDict[library.code];

            libraries.push({
                name: library.name,
                code: library.code,
                count,
            });
        });

        libraries.sort((a, b) => {
            return b.count - a.count;
        });

        return libraries;
    }
}
