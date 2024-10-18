import {Subscription} from "rxjs";
import {Component, OnDestroy, OnInit} from "@angular/core";
import {CloudAppConfigService, CloudAppRestService,} from "@exlibris/exl-cloudapp-angular-lib";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ParseReportService} from "../parse-report.service";
import {ReportService} from "../report.service";
import {Router} from "@angular/router";
import {filter} from "rxjs/operators";

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
    inventoryForm: FormGroup;

    institutionLibraries: Library[] = [];
    scanLocations: ScanLocation[] = [];
    itemTypes: ItemType[] = [];
    policyTypes: PolicyType[] = [];

    private filteredScanLocations: ScanLocation[] = [];

    private reportCompleteSubscription: Subscription
    private libraryCodeSubscription: Subscription;
    private physicalItemsSubscription: Subscription
    private postprocessSubscription: Subscription
    private markAsInventoriedField: string | null = null;

    private libraryDict: { [key: string]: number } = {};
    private locationDict: { [key: string]: number } = {};
    private itemTypeDict: { [key: string]: number } = {};
    private policyTypeDict: { [key: string]: number } = {};

    constructor(
        private restService: CloudAppRestService,
        private fb: FormBuilder,
        private prs: ParseReportService,
        private reportService: ReportService,
        private router: Router,
        private configurationService: CloudAppConfigService
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
            sortBy: ["correctOrder", Validators.required],
            markAsInventoried: [false, Validators.required],
            scanInItems: [false, Validators.required],
        });

        this.inventoryForm.get("markAsInventoried").disable()
        this.inventoryForm.get("scanInItems").disable()

        this.postprocessSubscription = this.configurationService.get().subscribe(values => {
            if (!values) {
                console.log("Postprocess Not Configured")
            } else {
                if (values["inventoryField"] !== 'None') {
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

        this.physicalItemsSubscription = this.prs.getParsedPhysicalItemsOnce().subscribe(physicalItems => {
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
        if (this.reportCompleteSubscription) {
            this.reportCompleteSubscription.unsubscribe()
        }
        this.physicalItemsSubscription.unsubscribe()
        this.postprocessSubscription.unsubscribe()
    }

    public onBack(): void {
        this.prs.reset()
        this.reportService.reset()
        this.router.navigate(['/', 'job-results-input'])
    }

    public onSubmit() {
        if (this.reportCompleteSubscription) this.reportCompleteSubscription.unsubscribe()
        const callNumberType = this.inventoryForm.get("callNumberType").value
        const library = this.inventoryForm.get("library").value
        const scanLocations = this.inventoryForm.get("scanLocations").value
        const expectedItemTypes = this.inventoryForm.get("expectedItemTypes").value
        const expectedPolicyTypes = this.inventoryForm.get("expectedPolicyTypes").value
        const limitOrderProblems = this.inventoryForm.get("limitOrderProblems").value
        const reportOnlyProblems = this.inventoryForm.get("reportOnlyProblems").value
        const sortBy = this.inventoryForm.get("sortBy").value
        const markAsInventoried = this.inventoryForm.get("markAsInventoried").value ? this.markAsInventoriedField : null
        const scanInItems = this.inventoryForm.get("scanInItems").value
        this.reportService.generateReport(callNumberType, library, scanLocations, expectedItemTypes, expectedPolicyTypes, limitOrderProblems, reportOnlyProblems, sortBy, markAsInventoried, scanInItems)
        this.router.navigate(["/", 'report-loading'])
    }

    public onSelectNewLibrary(libraryCode: string) {
        this.restService
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
    }

    public filterScanLocations(): void {
        const filterValue = this.inventoryForm
            .get("scanLocation")
            .value.toLowerCase();
        this.filteredScanLocations = this.scanLocations.filter((sl) =>
            sl.name.toLowerCase().includes(filterValue)
        );
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
