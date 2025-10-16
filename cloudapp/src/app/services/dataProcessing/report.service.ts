import {Injectable} from "@angular/core";
import {PhysicalItem} from "../fileParsing/physical-item-info.service";
import {Subscription} from "rxjs";
import * as XLSX from 'xlsx';
import {CallNumberService} from "./call-number.service";

export interface ProcessedPhysicalItem extends PhysicalItem {
    hasProblem: boolean,
    callSort: string | null,
    normalizedDescription: string | null,
    sortable: boolean,
    actualLocation: number | null,
    actualLocationInUnsortablesRemovedList: number | undefined,
    correctLocation: number | null,
    hasUnparsableCallNumberProblem: string | null,
    hasOrderProblem: string | null,
    hasTemporaryLocationProblem: string | null,
    hasLibraryProblem: string | null,
    hasRequestProblem: string | null,
    hasTypeProblem: string | null,
    hasLocationProblem: string | null,
    hasNotInPlaceProblem: string | null,
    hasPolicyProblem: string | null,
    needsToBeScannedIn: boolean,
    wasScannedIn: boolean,
}

export interface ReportData {
    outputFilename: string,
    sortBy: string,
    library: string,
    circDesk: string | null,
    reportOnlyProblems: boolean,
    orderProblemLimit: string,
    notInAlmaProblemCount: number | string,
    unparsableCallNumberProblemCount: number | string,
    orderProblemCount: number | string,
    temporaryLocationProblemCount: number | string,
    libraryProblemCount: number | string,
    requestProblemCount: number | string,
    policyProblemCount: number | string,
    typeProblemCount: number | string,
    locationProblemCount: number | string,
    notInPlaceProblemCount: number | string,
    firstCallNum: string,
    lastCallNum: string,
    unsortedItems: ProcessedPhysicalItem[],
    sortedItems: ProcessedPhysicalItem[]
}

@Injectable({
    providedIn: "root",
})
export class ReportService {
    private report: ReportData | undefined;
    private physicalItemsSubscription: Subscription | undefined;

    constructor(private callNumberService: CallNumberService) {
    }

    public getReport() {
        return this.report;
    }

    reset() {
        if (this.physicalItemsSubscription) this.physicalItemsSubscription.unsubscribe()
        this.report = undefined;
    }

    generateReport(
        callNumberType: string,
        libraryCode: string,
        locationCodes: string[],
        expectedItemTypes: string[],
        expectedPolicyTypes: string[],
        allowBlankItemPolicy: boolean,
        orderProblemLimit: string,
        reportOnlyProblems: boolean,
        sortBy: string,
        sortMultiVolumeByDescription: boolean,
        circDeskCode: string | null,
        scanDate: string,
        physicalItems: PhysicalItem[]
    ): ReportData {
        this.report = undefined
        const unsorted: ProcessedPhysicalItem[] = []

        physicalItems.map((physicalItem: PhysicalItem) => {
            const processedPhysicalItem: ProcessedPhysicalItem = {
                ...physicalItem,
                hasProblem: false,
                callSort: null,
                normalizedDescription: null,
                sortable: true,
                actualLocation: null,
                actualLocationInUnsortablesRemovedList: undefined,
                correctLocation: null,
                hasUnparsableCallNumberProblem: null,
                hasLibraryProblem: null,
                hasLocationProblem: null,
                hasTemporaryLocationProblem: null,
                hasOrderProblem: null,
                hasRequestProblem: null,
                hasTypeProblem: null,
                hasPolicyProblem: null,
                hasNotInPlaceProblem: null,
                needsToBeScannedIn: false,
                wasScannedIn: false,
            }
            return processedPhysicalItem
        }).forEach((item: ProcessedPhysicalItem, i: number) => {
            if (!item.callNumber) item.callNumber = "";
            // Barcode was found so we can store a normalized call number to use for sorting.
            if (item.itemMaterialType && item.itemMaterialType == "DVD") {
                item.callNumber = item.callNumber.replace(/^DVD\s*/, "")
            }

            if (callNumberType == "Dewey") item.callSort = this.callNumberService.normalizeDewey(item.callNumber);
            else item.callSort = this.callNumberService.normalizeLC(item.callNumber)

            item.actualLocation = i + 1

            // Determine whether the item is sortable
            if (item.callSort === "~" || item.callSort === " " || item.callSort === "") {
                item.sortable = false
                if (item.existsInAlma) {
                    item.hasUnparsableCallNumberProblem = "**UNPARSABLE CALL NUMBER**"
                }
            }
            unsorted.push(item)
        })

        const unsortedWithUnsortablesRemoved = unsorted.filter(item => {
            return item.sortable
        })
        unsortedWithUnsortablesRemoved.forEach((item, i) => {
            item.actualLocationInUnsortablesRemovedList = i + 1
        })

        // Create a sorted array.
        const sorted = [...unsortedWithUnsortablesRemoved].sort(callNumberType === "LC" ? (a, b) => {
            return this.callNumberService.sortLC(a, b, sortMultiVolumeByDescription)
        } : (a, b) => {
            return this.callNumberService.sortDewey(a, b, sortMultiVolumeByDescription)
        })

        sorted.forEach((item, index) => {
            // Flag order issues unless "Only problems other than CN Order" is requested
            if (orderProblemLimit !== "onlyOther") {
                this.calculateOrderProblems(item, index, sorted, unsortedWithUnsortablesRemoved, sortMultiVolumeByDescription);
            } // Finished calculating order issues

            // Flag other issues unless "Only CN Order problems" is requested.
            if (orderProblemLimit !== "onlyOrder") {
                this.calculateOtherProblems(item, locationCodes, libraryCode, expectedPolicyTypes, allowBlankItemPolicy, expectedItemTypes);

                // ONLY run the scanning in code if the 'onlyOrder' function is not activated -- this is because these items WILL NOT SHOW
                // on the report in that mode. That mode is designed for only order, NOT for fixing not in place issues.
                const itemNotInPlace = item.status === "Item not in place"
                const itemModifiedOnOrAfterScanDate = (item.lastModifiedDate ? item.lastModifiedDate : 0) >= new Date(scanDate).getTime()
                const itemHasLoanOnOrAfterScanDate = item.processType === "LOAN" && item.lastLoanDate && item.lastLoanDate >= new Date(scanDate).getTime()
                if (itemNotInPlace && !item.hasLibraryProblem && !item.hasLocationProblem && !itemModifiedOnOrAfterScanDate && !itemHasLoanOnOrAfterScanDate) {
                    item.needsToBeScannedIn = true
                    console.log(`Item ${item.barcode} needs to be scanned in: Last Modified ${item.lastModifiedDate}, last loan ${item.lastLoanDate}`)
                }
            } // Finished calculating non-order-related issues

            // These issues should be shown on ALL modes
            if (!item.existsInAlma || item.hasUnparsableCallNumberProblem) {
                item.hasProblem = true
            }

            item.correctLocation = index + 1
        })

        const {
            notInAlmaProblemCount,
            unparsableCallNumberProblemCount,
            orderProblemCount,
            temporaryLocationProblemCount,
            libraryProblemCount,
            requestProblemCount,
            locationProblemCount,
            policyProblemCount,
            typeProblemCount,
            notInPlaceProblemCount
        } = this.getProblemCounts(orderProblemLimit, unsorted);

        const firstItem = unsorted[0]
        const lastItem = unsorted[unsorted.length - 1]
        let firstCallNum = firstItem.callNumber ? firstItem.callNumber.replace(".", "").replace(" ", "") : ""
        firstCallNum = firstCallNum.padEnd(5, "_")
        let lastCallNum = lastItem.callNumber ? lastItem.callNumber.replace(".", "").replace(" ", "") : ""
        lastCallNum = lastCallNum.padEnd(5, "_")
        const outputFilename = `Shelflist_${libraryCode}_${locationCodes.join("_")}_${firstCallNum.substring(0, 4)}_${lastCallNum.substring(0, 4)}_${new Date().toISOString().slice(0, 10)}.xlsx`
        this.report = {
            outputFilename,
            sortBy,
            library: libraryCode,
            circDesk: circDeskCode,
            reportOnlyProblems,
            orderProblemLimit,
            notInAlmaProblemCount,
            unparsableCallNumberProblemCount,
            orderProblemCount,
            temporaryLocationProblemCount,
            libraryProblemCount,
            requestProblemCount,
            locationProblemCount,
            policyProblemCount,
            typeProblemCount,
            notInPlaceProblemCount,
            firstCallNum,
            lastCallNum,
            unsortedItems: unsorted,
            sortedItems: sorted
        }
        return this.report
    }

    protected getProblemCounts(orderProblemLimit: string, items: ProcessedPhysicalItem[]) {
        const notInAlmaProblemCount = items.reduce((acc, item) => {
            return item.existsInAlma ? acc : acc + 1
        }, 0)
        const unparsableCallNumberProblemCount = items.reduce((acc, item) => {
            return item.hasUnparsableCallNumberProblem ? acc + 1 : acc;
        }, 0)
        const orderProblemCount = (orderProblemLimit !== "onlyOther") ? items.reduce((acc, item) => {
            return item.hasOrderProblem && item.hasOrderProblem !== "**Multi-Volume Order Not Checked**" ? acc + 1 : acc
        }, 0) : "n/a"
        const temporaryLocationProblemCount = (orderProblemLimit !== "onlyOrder") ? items.reduce((acc, item) => {
            return item.hasTemporaryLocationProblem ? acc + 1 : acc
        }, 0) : "n/a"
        const libraryProblemCount = (orderProblemLimit !== "onlyOrder") ? items.reduce((acc, item) => {
            return item.hasLibraryProblem ? acc + 1 : acc
        }, 0) : "n/a"
        const requestProblemCount = (orderProblemLimit !== "onlyOrder") ? items.reduce((acc, item) => {
            return item.hasRequestProblem ? acc + 1 : acc
        }, 0) : "n/a"
        const locationProblemCount = (orderProblemLimit !== "onlyOrder") ? items.reduce((acc, item) => {
            return item.hasLocationProblem ? acc + 1 : acc
        }, 0) : "n/a"
        const policyProblemCount = (orderProblemLimit !== "onlyOrder") ? items.reduce((acc, item) => {
            return item.hasPolicyProblem ? acc + 1 : acc
        }, 0) : "n/a"
        const typeProblemCount = (orderProblemLimit !== "onlyOrder") ? items.reduce((acc, item) => {
            return item.hasTypeProblem ? acc + 1 : acc
        }, 0) : "n/a"
        const notInPlaceProblemCount = (orderProblemLimit !== "onlyOrder") ? items.reduce((acc, item) => {
            return item.hasNotInPlaceProblem ? acc + 1 : acc
        }, 0) : "n/a"
        return {
            notInAlmaProblemCount,
            unparsableCallNumberProblemCount,
            orderProblemCount,
            temporaryLocationProblemCount,
            libraryProblemCount,
            requestProblemCount,
            locationProblemCount,
            policyProblemCount,
            typeProblemCount,
            notInPlaceProblemCount
        };
    }

    protected calculateOtherProblems(item: ProcessedPhysicalItem, locationCodes: string[], libraryCode: string, expectedPolicyTypes: string[], allowBlankItemPolicy: boolean, expectedItemTypes: string[]) {
        if (item.status !== "Item in place") {
            item.hasProblem = true
            item.hasNotInPlaceProblem = `**Not In Place: ${item.processType}**`
        }

        if (item.requested) {
            item.hasProblem = true
            item.hasRequestProblem = "**ITEM HAS REQUEST**"
        }

        const hasLocationProblem = !item.location || !locationCodes.includes(item.location)
        const hasLibraryProblem = item.library !== libraryCode
        const hasPolicyTypeProblem = item.policyType ? !expectedPolicyTypes.includes(item.policyType) : !allowBlankItemPolicy
        // First, deal with items that should be in a temp location but are not
        if (item.inTempLocation) {
            // Item SHOULD BE in temp location if Library or Location is wrong here.
            if (hasLibraryProblem || hasLocationProblem) {
                item.hasProblem = true
                const correctTempLocation = item.location! + (item.hasOwnProperty('locationName') && item["locationName"] ? ` (${item.locationName})` : "")
                const correctLibrary = item.library! + (item.hasOwnProperty("libraryName") && item["libraryName"] ? ` (${item.libraryName})` : "")
                item.hasTemporaryLocationProblem = `**Item should be in temp location ${correctTempLocation} in library ${correctLibrary}**`
                return
            }
        }

        if (hasLocationProblem) {
            item.hasProblem = true
            item.hasLocationProblem = `**WRONG LOCATION: ${item.location}${item.hasOwnProperty("locationName") && item["locationName"] ? " (" + item.locationName + ")" : ""}; expected any of [${locationCodes.join(", ")}]**`
            item.hasOrderProblem = null
        }

        if (hasLibraryProblem) {
            item.hasProblem = true
            item.hasLibraryProblem = `**WRONG LIBRARY: ${item.library}${item.hasOwnProperty("libraryName") && item["libraryName"] ? " (" + item.libraryName + ")" : ""}; expected ${libraryCode}**`
            item.hasOrderProblem = null
        }

        if (hasPolicyTypeProblem) {
            if (item.policyType) {
                item.hasPolicyProblem = `**WRONG ITEM POLICY: ${item.policyType}${item.hasOwnProperty("policyTypeName") && item["policyTypeName"] ? " (" + item.policyTypeName + ")" : ""}; expected any of [${expectedPolicyTypes.join(", ")}]**`
                item.hasProblem = true
            } else {
                item.hasPolicyProblem = "**BLANK ITEM POLICY**"
                item.hasProblem = true
            }
        }

        if (!item.itemMaterialType || expectedItemTypes.length > 0 && !expectedItemTypes.includes(item.itemMaterialType)) {
            if (item.itemMaterialType) {
                item.hasTypeProblem = `**WRONG TYPE: ${item.itemMaterialType}${item.hasOwnProperty("itemMaterialTypeName") && item["itemMaterialTypeName"] ? " (" + item.itemMaterialTypeName + ")" : ""}; expected any of [${expectedItemTypes.join(", ")}]**`
            } else {
                item.hasTypeProblem = "**BLANK ITEM MATERIAL TYPE**"
            }
            item.hasProblem = true
        }
    }

    protected calculateOrderProblems(item: ProcessedPhysicalItem, index: number, sorted: ProcessedPhysicalItem[], unsortedWithUnsortablesRemoved: ProcessedPhysicalItem[], sortMultiVolumeByDescription: boolean) {
        if (item.existsInAlma) {
            const actualLocationIndex = item.actualLocationInUnsortablesRemovedList! - 1
            const itemIsInTheCorrectAbsolutePosition = index === actualLocationIndex

            const correctPreviousItemCallNum = index > 0 ? sorted[index - 1].callNumber : "LOCATION START"
            const correctPreviousItemDescription = index > 0 ? sorted[index - 1].description : "LOCATION START"
            const correctNextItemCallNum = index < sorted.length - 1 ? sorted[index + 1].callNumber : "LOCATION END"
            const correctNextItemDescription = index < sorted.length - 1 ? sorted[index + 1].description : "LOCATION END"

            const isMultiVolume = correctNextItemCallNum === item.callNumber || correctPreviousItemCallNum === item.callNumber

            // Get actual previous call number based on actualLocation
            const actualPreviousItemCallNum = actualLocationIndex > 0 ? unsortedWithUnsortablesRemoved[actualLocationIndex - 1].callNumber : "LOCATION START";
            const actualPreviousDescription = actualLocationIndex > 0 ? unsortedWithUnsortablesRemoved[actualLocationIndex - 1].description : "LOCATION START";
            // Get actual next call number based on actualLocation
            const actualNextItemCallNumber = actualLocationIndex < unsortedWithUnsortablesRemoved.length - 1 ? unsortedWithUnsortablesRemoved[actualLocationIndex + 1].callNumber : "LOCATION END";
            const actualNextItemDescription = actualLocationIndex < unsortedWithUnsortablesRemoved.length - 1 ? unsortedWithUnsortablesRemoved[actualLocationIndex + 1].description : "LOCATION END";

            const previousItemIsAlreadyCorrect = actualPreviousItemCallNum === correctPreviousItemCallNum
            const nextItemIsAlreadyCorrect = actualNextItemCallNumber === correctNextItemCallNum

            const isRogueItem = !previousItemIsAlreadyCorrect && !nextItemIsAlreadyCorrect
            if (!itemIsInTheCorrectAbsolutePosition) {
                if (isMultiVolume) {
                    if (sortMultiVolumeByDescription) {
                        const previousMultiVolumeIsAlreadyCorrect = actualPreviousItemCallNum === correctPreviousItemCallNum && actualPreviousDescription === correctPreviousItemDescription
                        const nextMultiVolumeIsAlreadyCorrect = actualNextItemCallNumber === correctNextItemCallNum && actualNextItemDescription === correctNextItemDescription
                        const isOutOfOrderWithinMultiVolume = !previousMultiVolumeIsAlreadyCorrect || !nextMultiVolumeIsAlreadyCorrect
                        if (isOutOfOrderWithinMultiVolume) item.hasOrderProblem = `**OUT OF ORDER**; should be between '${correctPreviousItemCallNum}' (${correctPreviousItemDescription}) and '${correctNextItemCallNum}' (${correctNextItemDescription})`
                        item.hasProblem = true
                    }
                }
            }

            if (isRogueItem && !isMultiVolume) {
                item.hasProblem = true
                item.hasOrderProblem = `**OUT OF ORDER**; should be between '${correctPreviousItemCallNum}' and '${correctNextItemCallNum}'`
            }

            // Mark multi-volume order as not being checked. Disabled for now as it's not particularly useful.
            // if (isMultiVolume && !sortMultiVolumeByDescription) item.hasOrderProblem = item.hasOrderProblem ? item.hasOrderProblem + " || **Multi-Volume Order Not Checked**" : "**Multi-Volume Order Not Checked**"
        } else {
            item.hasProblem = true
        }
    }

    generateAndDownloadExcel(reportData: ReportData) {
        // if sortBy is by actual order, use the unsorted array. Else, use the sorted array but add all unsorted items
        // to the end
        let arrayToDisplay: ProcessedPhysicalItem[];
        if (reportData.sortBy === "correctOrder") {
            const unparsableItems = reportData.unsortedItems.filter(item => {
                return !item.sortable
            })
            arrayToDisplay = [...reportData.sortedItems, ...unparsableItems]
        } else {
            arrayToDisplay = reportData.unsortedItems
        }

        const formattedReport = arrayToDisplay.filter((item) => {
            if (reportData.reportOnlyProblems) {
                if (!item.existsInAlma) return true
                return item.hasProblem
            } else return true
        }).map(item => {
            let reportCols: object = {
                "Barcode": item.barcode,
            }

            if (reportData.sortBy === "correctOrder") {
                reportCols = {
                    ...reportCols,
                    "Actual Position": item.actualLocation,
                }
            } else {
                reportCols = {
                    ...reportCols,
                    "Correct Position": item.correctLocation ? item.correctLocation : "?",
                }
            }

            reportCols = {
                ...reportCols,
                "Call Number": item.callNumber,
                "Description": item.description,
                "Title": item.title ? (item.title.length > 65 ? item.title.slice(0, 62) + "..." : item.title) : "",
            }

            // These two issues should be reported on by all modes
            const notInAlmaOrUnparsableCallNumIssue = [item.existsInAlma ? "" : "**NOT IN ALMA**", item.hasUnparsableCallNumberProblem].filter(val => {
                return !!val
            }).join(" || ")

            // If the report shows order issues at all
            if (!(reportData.orderProblemLimit === "onlyOther")) {
                reportCols = {
                    ...reportCols,
                    "Order Issues": [item.hasOrderProblem, notInAlmaOrUnparsableCallNumIssue].filter(val => {
                        return !!val
                    }).join(" || ")
                }
            }

            // If the report shows other issues at all
            if (!(reportData.orderProblemLimit === "onlyOrder")) {
                let otherProblems = [item.hasLibraryProblem, item.hasLocationProblem, item.hasNotInPlaceProblem, item.hasTemporaryLocationProblem, item.hasPolicyProblem, item.hasRequestProblem, item.hasTypeProblem, notInAlmaOrUnparsableCallNumIssue].filter(val => {
                    return !!val
                }).join(" || ")
                reportCols = {
                    ...reportCols,
                    "Other Problems": otherProblems,
                    "Needs to be Scanned In": item.needsToBeScannedIn ? true : "",
                    "Scanned In": item.needsToBeScannedIn ? item.wasScannedIn : ""
                }
            }

            return reportCols
        })

        const worksheet = XLSX.utils.json_to_sheet(formattedReport)

        // Apply alignment settings to prevent overflow
        for (const cellAddress in worksheet) {
            if (cellAddress.startsWith('!')) continue; // Skip non-cell properties
            const cell = worksheet[cellAddress];
            if (cell) {
                cell.s = {
                    alignment: {
                        wrapText: true,  // Wraps text to prevent overflow
                        horizontal: 'center',  // Center-aligns text, optional
                        vertical: 'top'  // Aligns text to the top of the cell, optional
                    }
                };
            }
        }

        // Set column widths
        worksheet['!cols'] = [
            {wch: 15},  // Barcode column width
            {wch: 15},  // Correct / Actual Position column width
            {wch: 25},  // Call Number column width
            {wch: 25},  // Description column width
            {wch: 58},  // Title column width
            {wch: 50},  // Order issues column width
            {wch: 50},  // Other issues column width
        ];

        const workbook: XLSX.WorkBook = {
            Sheets: {'Sheet1': worksheet},
            SheetNames: ['Sheet1'],
        };

        XLSX.writeFile(workbook, reportData.outputFilename);
    }
}