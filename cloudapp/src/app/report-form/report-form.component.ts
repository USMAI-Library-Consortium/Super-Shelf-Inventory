import {Subscription, combineLatest, BehaviorSubject, Observable, of} from "rxjs";
import {Component, OnDestroy, OnInit} from "@angular/core";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {map, switchMap, tap} from "rxjs/operators";
import {Router} from "@angular/router";
import {CloudAppConfigService, CloudAppEventsService} from "@exlibris/exl-cloudapp-angular-lib";

import {SetService} from "../services/apis/set.service";
import {MarkAsInventoriedJob, PostprocessService, ScanInResults} from "../services/apis/postprocess.service";
import {PhysicalItem, PhysicalItemInfoService} from "../services/fileParsing/physical-item-info.service";
import {BarcodeParserService} from "../services/fileParsing/barcode-parser.service";
import {ReportService} from "../services/dataProcessing/report.service";
import {IndividualItemInfoService} from "../services/apis/individual-item-info.service";
import {BackupItemExportService} from "../services/apis/backup-item-export.service";

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
    name: string;
    count: number;
}

interface PolicyType {
    code: string;
    name: string;
    count: number;
}

@Component({
    selector: "app-report-form",
    templateUrl: "./report-form.component.html",
    styleUrls: ["./report-form.component.scss"],
})
export class ReportForm implements OnInit, OnDestroy {
    public inventoryForm: FormGroup;

    // Final, merged dropdown lists.
    public institutionLibrariesForDropdown: Library[] = [];
    public scanLocationsForDropdown: ScanLocation[] = [];
    public itemTypesForDropdown: ItemType[] = [];
    public policyTypesForDropdown: PolicyType[] = [];
    public circDesksForDropdown: CircDesk[] = [];

    private librariesFromPhysicalItems: {
        [key: string]: {
            name: string;
            count: number;
        }
    } = {};
    private scanLocationsFromPhysicalItems: {
        [key: string]: {
            name: string;
            count: number;
        }
    } = {};
    private itemTypesFromPhysicalItems: {
        [key: string]: {
            name: string;
            count: number;
        }
    } = {};
    private policyTypesFromPhysicalItems: {
        [key: string]: {
            name: string;
            count: number;
        }
    } = {};

    public reportLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    private markAsInventoriedField: string | null = null;

    // Subscriptions
    private reportLoadingSubscription: Subscription
    private enableCircDeskSubscription: Subscription;
    private enableReportOnlyProblemsSubscription: Subscription;
    private enablePostprocessSubscription: Subscription;
    private reportSetupSubscription: Subscription;

    constructor(
        private fb: FormBuilder,
        private bps: BarcodeParserService,
        private physicalItemInfoService: PhysicalItemInfoService,
        private iii: IndividualItemInfoService,
        private reportService: ReportService,
        public setService: SetService,
        public postProcessService: PostprocessService,
        private bes: BackupItemExportService,
        private router: Router,
        private configurationService: CloudAppConfigService,
        private eventService: CloudAppEventsService
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

        // Set defaults for conditional options to disabled.
        this.inventoryForm.get("markAsInventoried").disable()
        this.inventoryForm.get("scanInItems").disable()
        this.inventoryForm.get("circDesk").disable()
        this.inventoryForm.get("reportOnlyProblems").disable()

        // Set conditional options based on user inputs
        this.enableCircDeskSubscription = this.inventoryForm.get("scanInItems").valueChanges.subscribe(value => this.enableOrDisableCircDeskInput(value))
        this.enableReportOnlyProblemsSubscription = this.inventoryForm.get('limitOrderProblems').valueChanges.subscribe(value => this.enableOrDisableReportOnlyProblems(value))
        this.enablePostprocessSubscription = this.configurationService.get().subscribe(value => this.enableOrDisablePostprocess(value))

        // Parse Physical Items Information, for use in Autofill
        this.reportSetupSubscription = this.eventService.getInitData().pipe(map(initData => {
            // Get just the user data we want
            return {
                "isAdmin": initData.user.isAdmin,
                "circDesk": initData.user.currentlyAtCircDesk
            }
        }), tap(_ => {
            // Parse codes, names, and quantities for the dropdowns
            this.parsePhysicalItemAutofillData(this.physicalItemInfoService.physicalItems)
        }), tap(userSettings => {
            // Set dropdown displays
            this.setDisplayLists(userSettings.circDesk)
        })).subscribe()
    }

    public onSubmit() {
        this.reportLoading$.next(true)
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

        const report = this.reportService.generateReport(callNumberType, library, scanLocations, expectedItemTypes, expectedPolicyTypes, limitOrderProblems, reportOnlyProblems, sortBy, sortSerialsByDescription, circDesk, this.bps.scanDate, this.physicalItemInfoService.physicalItems)

        let markAsInventoriedJob: Observable<MarkAsInventoriedJob> = null
        if (markAsInventoried) {
            const barcodes: string[] = report.unsortedItems.map(item => item.barcode)
            markAsInventoriedJob = this.setService.getLatestSetInfoOrCreateSet(barcodes).pipe(switchMap(setInfo => {
                return this.postProcessService.markAsInventoried(markAsInventoried, this.bps.scanDate, setInfo)
            }))
        }

        let scanInItemsJob: Observable<ScanInResults> = null
        if (scanInItems) scanInItemsJob = this.postProcessService.scanInItems(report.unsortedItems, library, circDesk)

        if (markAsInventoriedJob || scanInItemsJob) {
            const jobs: Observable<any>[] = []
            if (markAsInventoriedJob) jobs.push(markAsInventoriedJob)
            if (scanInItemsJob) jobs.push(scanInItemsJob)

            this.reportLoadingSubscription = combineLatest(jobs).subscribe(_ => {
                this.router.navigate(['results'])
            })
        } else {
            this.router.navigate(['results'])
        }
    }

    private setDisplayLists(circDesk: string) {
        let libraryWithHighestCount = ""
        for (let key of Object.keys(this.librariesFromPhysicalItems)) {
            if(!key || key === "null") continue;
            this.institutionLibrariesForDropdown.push({
                code: key,
                name: this.librariesFromPhysicalItems[key]['name'],
                count: this.librariesFromPhysicalItems[key]['count']
            })
            if (!libraryWithHighestCount) libraryWithHighestCount = key
            if (libraryWithHighestCount && this.librariesFromPhysicalItems[key]['count'] > this.librariesFromPhysicalItems[libraryWithHighestCount]['count']) {
                libraryWithHighestCount = key
            }
        }

        this.inventoryForm.get('library').setValue(libraryWithHighestCount)

        for (let mapping of [{
            source: this.scanLocationsFromPhysicalItems,
            dest: this.scanLocationsForDropdown,
            control: "scanLocations"
        }, {
            source: this.itemTypesFromPhysicalItems,
            dest: this.itemTypesForDropdown,
            control: "expectedItemTypes"
        }, {
            source: this.policyTypesFromPhysicalItems,
            dest: this.policyTypesForDropdown,
            control: "expectedPolicyTypes"
        }]) {
            for (let key of Object.keys(mapping.source)) {
                if(!key || key === "null") continue;
                let itemCount = mapping.source[key]['count']
                mapping.dest.push({
                    code: key,
                    name: mapping.source[key]['name'],
                    count: itemCount
                })
                if (itemCount > 5) {
                    const currentValue = this.inventoryForm.get(mapping.control).value || [];
                    const newValue = [...currentValue, key];
                    this.inventoryForm.get(mapping.control).setValue(newValue);
                }
            }
        }

        if (circDesk) this.inventoryForm.get('circDesk').setValue(circDesk)
    }

    private parsePhysicalItemAutofillData(physicalItems: PhysicalItem[]) {
        // Parse out the information needed to create dropdowns and such.
        physicalItems.forEach(item => {
            // Parse Library Info
            const itemLibraryAlreadyAddedToDict = item.library in this.librariesFromPhysicalItems
            if (!itemLibraryAlreadyAddedToDict) {
                this.librariesFromPhysicalItems[item.library] = {
                    count: 1,
                    name: item.hasOwnProperty("libraryName") ? item.libraryName : null
                }
            } else {
                this.librariesFromPhysicalItems[item.library].count += 1
            }

            // Parse Location Info
            const itemLocationAlreadyAddedToDict = item.location in this.scanLocationsFromPhysicalItems
            if (!itemLocationAlreadyAddedToDict) {
                this.scanLocationsFromPhysicalItems[item.location] = {
                    count: 1,
                    name: item.hasOwnProperty("locationName") ? item.locationName : null,
                }
            } else {
                this.scanLocationsFromPhysicalItems[item.location].count += 1
            }

            // Parse Item Type Info
            const itemTypeAlreadyAddedToDict = item.itemMaterialType in this.itemTypesFromPhysicalItems
            if (!itemTypeAlreadyAddedToDict) {
                this.itemTypesFromPhysicalItems[item.itemMaterialType] = {
                    count: 1,
                    name: item.hasOwnProperty("itemMaterialTypeName") ? item.itemMaterialTypeName : null
                }
            } else {
                this.itemTypesFromPhysicalItems[item.itemMaterialType].count += 1
            }

            // Parse Item Policy Info
            const itemPolicyAlreadyAddedToDict = item.policyType in this.policyTypesFromPhysicalItems
            if (!itemPolicyAlreadyAddedToDict) {
                this.policyTypesFromPhysicalItems[item.policyType] = {
                    count: 1,
                    name: item.hasOwnProperty("policyTypeName") ? item.policyTypeName : null
                }
            } else {
                this.policyTypesFromPhysicalItems[item.policyType].count += 1
            }
        })
    }

    private enableOrDisablePostprocess(configurationSettings: object) {
        if (!configurationSettings) {
            console.log("Postprocess Not Configured - using defaults (disabled)")
        } else {
            const markAsInventoriedAllowed = configurationSettings["inventoryField"] && configurationSettings["inventoryField"] !== 'None' && configurationSettings["inventoryField"] !== "undefined"
            if (markAsInventoriedAllowed) {
                this.inventoryForm.get("markAsInventoried").enable()
                this.markAsInventoriedField = configurationSettings["inventoryField"];
                console.log(`Marking Inventory Allowed - stored in ${configurationSettings["inventoryField"]}`)
            }
            if (configurationSettings["allowScanIn"]) {
                this.inventoryForm.get("scanInItems").enable()
                console.log(`Scanning In Items Allowed.`)
            }
        }
    }

    private enableOrDisableReportOnlyProblems(orderProblemLimit: string) {
        if (orderProblemLimit === "onlyOther") {
            this.inventoryForm.get("reportOnlyProblems").enable()
        } else {
            this.inventoryForm.get("reportOnlyProblems").setValue(false)
            this.inventoryForm.get("reportOnlyProblems").disable()
        }
    }

    private enableOrDisableCircDeskInput(scanInItems: boolean) {
        const circDeskInput = this.inventoryForm.get("circDesk");
        if (scanInItems) {
            circDeskInput.enable()
            circDeskInput.setValidators([Validators.required])
        } else {
            circDeskInput.clearValidators()
            circDeskInput.disable()
        }
        circDeskInput.updateValueAndValidity()
    }

    public onBack(): void {
        const dataSource = this.physicalItemInfoService.physicalItems[0].source
        this.physicalItemInfoService.reset()
        this.iii.reset()
        this.bes.reset()
        this.reportService.reset()
        if (dataSource == 'job') {
            this.router.navigate(['/', 'job-results-input'])
        } else {
            this.router.navigate(['/'])
        }
    }

    ngOnDestroy(): void {
        if (this.reportLoadingSubscription) this.reportLoadingSubscription.unsubscribe()
        this.enableCircDeskSubscription.unsubscribe()
        this.enableReportOnlyProblemsSubscription.unsubscribe()
        this.enablePostprocessSubscription.unsubscribe()
        this.reportSetupSubscription.unsubscribe()
    }
}
