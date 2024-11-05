import {Injectable} from "@angular/core";
import {ParseReportService, PhysicalItem} from "./parse-report.service";
import {Observable, ReplaySubject, Subscription} from "rxjs";
import * as XLSX from 'xlsx';
import {filter, map, take} from "rxjs/operators";

export interface ProcessedPhysicalItem extends PhysicalItem {
    hasProblem: boolean,
    callSort: string | null,
    normalizedDescription: string | null,
    sortable: boolean,
    actualLocation: number | null,
    actualLocationInUnsortablesRemoved: number | null,
    correctLocation: number | null,
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
    circDesk: string,
    reportOnlyProblems: boolean,
    orderProblemLimit: string,
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
    markAsInventoriedField: string | null,
    scanInItems: boolean,
    unsortedItems: ProcessedPhysicalItem[],
    sortedItems: ProcessedPhysicalItem[]
}

@Injectable({
    providedIn: "root",
})
export class ReportService {
    reportProcessed$: ReplaySubject<ReportData | null> = new ReplaySubject(1)
    physicalItemsSubscription: Subscription = null

    constructor(private prs: ParseReportService) {
    }

    getLatestReport() {
        return this.reportProcessed$.pipe(filter(value => {
            return value !== null
        }), take(1))
    }

    reset() {
        if (this.physicalItemsSubscription) this.physicalItemsSubscription.unsubscribe()
        this.reportProcessed$.next(null)
    }

    generateReport(
        callNumberType: string,
        libraryCode: string,
        locationCodes: string[],
        expectedItemTypes: string[],
        expectedPolicyTypes: string[],
        orderProblemLimit: string,
        reportOnlyProblems: boolean,
        sortBy: string,
        sortSerialsByDescription: boolean,
        markAsInventoriedField: string | null,
        scanInItems: boolean,
        circDeskCode: string | null,
        scanDate: number
    ): Observable<ReportData> {
        this.reportProcessed$.next(null)
        this.physicalItemsSubscription = this.prs.getParsedPhysicalItemsOnce().pipe(map(data => {
            return JSON.parse(JSON.stringify(data))
        })).subscribe(physicalItems => {
            const unsorted: ProcessedPhysicalItem[] = []

            physicalItems.map((physicalItem: PhysicalItem) => {
                const processedPhysicalItem: ProcessedPhysicalItem = {
                    ...physicalItem,
                    hasProblem: false,
                    callSort: null,
                    normalizedDescription: null,
                    sortable: true,
                    actualLocation: null,
                    actualLocationInUnsortablesRemoved: null,
                    correctLocation: null,
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

                if (callNumberType == "Dewey") item.callSort = this.normalizeDewey(item.callNumber);
                else item.callSort = this.normalizeLC(item.callNumber)

                if (item.lastModifiedDate < scanDate && item.status === "Item not in place") {
                    item.needsToBeScannedIn = true
                    console.log(`Item ${item.barcode} needs to be scanned in `)
                }

                item.actualLocation = i + 1

                // Determine whether the item is sortable
                if (item.callSort === "~" || item.callSort === " " || item.callSort === "") {
                    item.sortable = false
                    item.hasOrderProblem = item.existsInAlma ? "**UNPARSABLE CALL NUMBER**" : "**NOT IN ALMA**"
                }
                unsorted.push(item)
            })

            const unsortedWithUnsortablesRemoved = unsorted.filter(item => {
                return item.sortable
            })
            unsortedWithUnsortablesRemoved.forEach((item, i) => {
                item.actualLocationInUnsortablesRemoved = i + 1
            })

            // Create a sorted array.
            const sorted = [...unsortedWithUnsortablesRemoved].sort(callNumberType === "Dewey" ? this.sortDewey : (a, b) => {
                return this.sortLC(a, b, sortSerialsByDescription)
            })

            sorted.forEach((item, index) => {
                // Flag order issues unless "Only problems other than CN Order" is requested
                if (orderProblemLimit !== "onlyOther") {
                    this.calculateOrderProblems(item, index, sorted, unsortedWithUnsortablesRemoved, sortSerialsByDescription);
                } // Finished calculating order issues

                // Flag other issues unless "Only CN Order problems" is requested.
                if (orderProblemLimit !== "onlyOrder") {
                    this.calculateOtherProblems(item, locationCodes, libraryCode, expectedPolicyTypes, expectedItemTypes);
                } // Finished calculating non-order-related issues

                item.correctLocation = index + 1
            })

            const {
                orderProblemCount,
                temporaryLocationProblemCount,
                libraryProblemCount,
                requestProblemCount,
                locationProblemCount,
                policyProblemCount,
                typeProblemCount,
                notInPlaceProblemCount
            } = this.getProblemCounts(orderProblemLimit, unsorted);

            console.log(`Problem Count for Orders: ${orderProblemCount}`)

            const firstItem = unsorted[0]
            const lastItem = unsorted[unsorted.length - 1]
            const firstCallNum = firstItem.callNumber.replace(".", "").replace(" ", "")
            const lastCallNum = lastItem.callNumber.replace(".", "").replace(" ", "")
            const outputFilename = `Shelflist_${libraryCode}_${locationCodes.join("_")}_${firstCallNum.substring(0, 4)}_${lastCallNum.substring(0, 4)}_${new Date().toISOString().slice(0, 10)}.xlsx`
            this.reportProcessed$.next({
                outputFilename,
                sortBy,
                library: libraryCode,
                circDesk: circDeskCode,
                reportOnlyProblems,
                orderProblemLimit,
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
                markAsInventoriedField,
                scanInItems,
                unsortedItems: unsorted,
                sortedItems: sorted
            })
        })

        return this.getLatestReport()
    }

    protected getProblemCounts(orderProblemLimit: string, items: ProcessedPhysicalItem[]) {
        // Get order problems
        const orderProblemCount = (orderProblemLimit !== "onlyOther") ? items.reduce((acc, item) => {
            return item.hasOrderProblem && item.hasOrderProblem !== "**Serial Order Not Checked**" ? acc + 1 : acc
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

    protected calculateOtherProblems(item: ProcessedPhysicalItem, locationCodes: string[], libraryCode: string, expectedPolicyTypes: string[], expectedItemTypes: string[]) {
        if (item.status !== "Item in place") {
            item.hasProblem = true
            item.hasNotInPlaceProblem = `**Not In Place: ${item.processType}**`
        }

        if (item.inTempLocation) {
            item.hasProblem = true
            item.hasTemporaryLocationProblem = "**IN TEMP LOC**"
        }

        if (item.requested) {
            item.hasProblem = true
            item.hasRequestProblem = "**ITEM HAS REQUEST**"
        }

        if (!locationCodes.includes(item.location)) {
            item.hasProblem = true
            item.hasLocationProblem = `**WRONG LOCATION: ${item.location}; expected any of [${locationCodes.join(", ")}]**`
        }

        if (item.library !== libraryCode) {
            item.hasProblem = true
            item.hasLibraryProblem = `**WRONG LIBRARY: ${item.library}; expected ${libraryCode}**`
        }

        if (expectedPolicyTypes.length > 0 && !expectedPolicyTypes.includes(item.policyType)) {
            if (item.policyType != "") {
                item.hasPolicyProblem = `**WRONG ITEM POLICY: ${item.policyType}; expected ${expectedPolicyTypes}**`
            } else {
                item.hasPolicyProblem = "**BLANK ITEM POLICY**"
            }
            item.hasProblem = true
        }

        if (expectedItemTypes.length > 0 && !expectedItemTypes.includes(item.itemMaterialType)) {
            if (item.itemMaterialType !== "") {
                item.hasTypeProblem = `**WRONG TYPE: ${item.itemMaterialType}; expected any of [${expectedItemTypes.join(", ")}]**`
            } else {
                item.hasTypeProblem = "**BLANK ITEM MATERIAL TYPE**"
            }
            item.hasProblem = true
        }
    }

    protected calculateOrderProblems(item: ProcessedPhysicalItem, index: number, sorted: ProcessedPhysicalItem[], unsortedWithUnsortablesRemoved: ProcessedPhysicalItem[], sortSerialsByDescription: boolean) {
        if (item.existsInAlma) {
            const actualLocationIndex = item.actualLocationInUnsortablesRemoved - 1
            const itemIsInTheCorrectAbsolutePosition = index === actualLocationIndex

            const correctPreviousItemCallNum = index > 0 ? sorted[index - 1].callNumber : "LOCATION START"
            const correctPreviousItemDescription = index > 0 ? sorted[index - 1].description : "LOCATION START"
            const correctNextItemCallNum = index < sorted.length - 1 ? sorted[index + 1].callNumber : "LOCATION END"
            const correctNextItemDescription = index < sorted.length - 1 ? sorted[index + 1].description : "LOCATION END"

            const itemIsSerial = correctNextItemCallNum === item.callNumber || correctPreviousItemCallNum === item.callNumber

            // Get actual previous call number based on actualLocation
            const actualPreviousItemCallNum = actualLocationIndex > 0 ? unsortedWithUnsortablesRemoved[actualLocationIndex - 1].callNumber : "LOCATION START";
            const actualPreviousDescription = actualLocationIndex > 0 ? unsortedWithUnsortablesRemoved[actualLocationIndex - 1].description : "LOCATION START";
            // Get actual next call number based on actualLocation
            const actualNextItemCallNumber = actualLocationIndex < unsortedWithUnsortablesRemoved.length - 1 ? unsortedWithUnsortablesRemoved[actualLocationIndex + 1].callNumber : "LOCATION END";
            const actualNextItemDescription = actualLocationIndex < unsortedWithUnsortablesRemoved.length - 1 ? unsortedWithUnsortablesRemoved[actualLocationIndex + 1].description : "LOCATION END";

            const previousItemIsAlreadyCorrect = actualPreviousItemCallNum === correctPreviousItemCallNum
            const nextItemIsAlreadyCorrect = actualNextItemCallNumber === correctNextItemCallNum

            const itemInCorrectRelativePosition = previousItemIsAlreadyCorrect && nextItemIsAlreadyCorrect

            const isRogueItem = !previousItemIsAlreadyCorrect && !nextItemIsAlreadyCorrect
            const isFirstItemOfBadSection = !previousItemIsAlreadyCorrect && nextItemIsAlreadyCorrect
            const isLastItemOfBadSection = previousItemIsAlreadyCorrect && !nextItemIsAlreadyCorrect
            if (!itemIsInTheCorrectAbsolutePosition) {
                if (isFirstItemOfBadSection) item.hasOrderProblem = `**OUT OF ORDER SECTION START**; should be after '${correctPreviousItemCallNum}'`
                if (isLastItemOfBadSection) item.hasOrderProblem = `**OUT OF ORDER SECTION END**; next item should be '${correctNextItemCallNum}'`
                if (!itemIsSerial) {
                    if (itemInCorrectRelativePosition) item.hasOrderProblem = "**Out Of Order section continued**"
                    if (isRogueItem) item.hasOrderProblem = `**OUT OF ORDER**; should be between '${correctPreviousItemCallNum}' and '${correctNextItemCallNum}'`
                } else {
                    if (sortSerialsByDescription) {
                        const previousSerialIsAlreadyCorrect = actualPreviousItemCallNum === correctPreviousItemCallNum && actualPreviousDescription === correctPreviousItemDescription
                        const nextSerialIsAlreadyCorrect = actualNextItemCallNumber === correctNextItemCallNum && actualNextItemDescription === correctNextItemDescription
                        const isOutOfOrderWithinSerial = !isFirstItemOfBadSection && !isLastItemOfBadSection && (!previousSerialIsAlreadyCorrect || !nextSerialIsAlreadyCorrect)
                        if (isOutOfOrderWithinSerial) item.hasOrderProblem = `**OUT OF ORDER**; should be between '${correctPreviousItemCallNum }' (${item.description}) and '${correctNextItemCallNum}' (${item.description})`
                    }
                }
                item.hasProblem = true;
            }

            if (itemIsSerial && !sortSerialsByDescription) item.hasOrderProblem = item.hasOrderProblem ? item.hasOrderProblem + " || **Serial Order Not Checked**" : "**Serial Order Not Checked**"
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
                return item.hasProblem
            } else return true
        }).map(item => {
            let reportCols: object = {
                "Barcode": item.barcode,
                "Correct Position": item.correctLocation ? item.correctLocation : "?",
                "Actual Position": item.actualLocation,
                "Call Number": item.callNumber,
                "Normalized Call Number": item.callSort,
                "Description": item.description,
                "Title": item.title ? (item.title.length > 65 ? item.title.slice(0, 62) + "..." : item.title) : "",
            }

            if (!(reportData.orderProblemLimit === "onlyOther")) {
                reportCols = {
                    ...reportCols,
                    "Order Issues": item.hasOrderProblem
                }
            }

            if (!(reportData.orderProblemLimit === "onlyOrder")) {
                reportCols = {
                    ...reportCols,
                    "Wrong Library Problem": item.hasLibraryProblem,
                    "Wrong Location Problem": item.hasLocationProblem,
                    "Not In Place Problem": item.hasNotInPlaceProblem,
                    "In Temporary Location Problem": item.hasTemporaryLocationProblem,
                    "Policy Problem": item.hasPolicyProblem,
                    "Has Active Request": item.hasRequestProblem,
                    "Item Material Type Problem": item.hasTypeProblem,
                    "Needs to be Scanned In": item.needsToBeScannedIn,
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
            {wch: 15},  // Correct Position column width
            {wch: 15},  // Actual Position column width
            {wch: 25},  // Call Number column width
            {wch: 30},  // Normalized Call Number column width
            {wch: 15},  // Normalized Description
            {wch: 58},  // Title column width
            {wch: 30},
            {wch: 30},
            {wch: 30},
            {wch: 30},
            {wch: 30},
            {wch: 30},
            {wch: 30},
            {wch: 30},
        ];

        const workbook: XLSX.WorkBook = {
            Sheets: {'Sheet1': worksheet},
            SheetNames: ['Sheet1'],
        };

        XLSX.writeFile(workbook, reportData.outputFilename);
    }

    public sortLC = (a: ProcessedPhysicalItem, b: ProcessedPhysicalItem, sortSerialsByDescription: boolean) => {
        const aCN: string = a.callSort ? a.callSort : this.normalizeLC(a.callNumber)
        const bCN: string = b.callSort ? b.callSort : this.normalizeLC(b.callNumber)
        let compareVal = aCN.localeCompare(bCN)
        if (compareVal === 0 && sortSerialsByDescription) {
            a.normalizedDescription = this.normalizeDescription(a.description)
            b.normalizedDescription = this.normalizeDescription(b.description)
            if (a.normalizedDescription && b.normalizedDescription) {
                // If call numbers are the same, and both have a description, sort by the description.
                compareVal = a.normalizedDescription.localeCompare(b.normalizedDescription)
            }
        }
        return compareVal
    }

    protected normalizeDescription(description: string) {
        if (!description) return ""
        const {lcCallNumber, integerMarkers} = this.prepareCallNumber(description)
        let normalizedDescription = lcCallNumber

        let skip = false
        integerMarkers.forEach(marker => {
            const exp2 = new RegExp(`(?<prefix>.*)?(?<integerMarker>${marker})(\\.)?\\s*(?<integer>\\d+);?.*(?<date1>\\d{4}).*(?<date2>\\d{4})?.*`, "i")
            const markerMatch = normalizedDescription.match(exp2); // Apply regex on 'theTrimmings'

            if (markerMatch?.groups && !skip) { // Safely access groups
                const {integerMarker, integer, date1, date2} = markerMatch.groups;
                const paddedInteger = integer.padStart(5, '0');
                description = `${integerMarker} ${paddedInteger} ${date1 ? date1 : ""} ${date2 ? date2 : ""}`;
                skip = true
            }
        });

        description = description.replace("\\", "")

        return description;
    }

    public normalizeLC(originalLCNumber: string) {
        /*
          User defined setting: set problems to top to sort unparsable
          call numbers to the top of the list; false to sort them to the
          bottom.
        */
        const problemsToTop = false;
        const unparsable = problemsToTop ? " " : "~";
        if (!originalLCNumber) return unparsable

        let {lcCallNumber, integerMarkers} = this.prepareCallNumber(originalLCNumber);

        const lcRegex = /^(?<initialLetters>[A-Z]{1,4})\s*(?<classNumber>\d+)\s*(?<decimalNumber>\.\d*)\s*(?<cutter1>\.*\s*(?<cutter1Letter>[A-Z]*)(?<cutter1Number>\d*))?\s*(?<cutter2>(?<cutter2Letter>[A-Z])(?<cutter2Number>\d+))?\s*(?<theTrimmings>.*)$/;
        const match = lcCallNumber.match(lcRegex);
        if (!match) return unparsable // return extreme answer if not a call number

        // Process the extracted variables as needed
        // Return or do something with the parsed data
        let {
            initialLetters,
            classNumber,
            decimalNumber,
            cutter1,
            cutter1Letter,
            cutter1Number,
            cutter2,
            cutter2Letter,
            cutter2Number,
            theTrimmings
        } = match.groups;
        // Set all values to empty string if they are undefined
        initialLetters = initialLetters || "";
        classNumber = classNumber || "";
        decimalNumber = decimalNumber || "";
        cutter1Letter = cutter1Letter || "";
        cutter1Number = cutter1Number || "";
        cutter2Letter = cutter2Letter || "";
        cutter2Number = cutter2Number || "";
        theTrimmings = theTrimmings || "";
        // 20 before 170
        // decimal number - need to fix. these are not by original design
        // Cutter 1 letter need to fix, 170.5.f should be after 170.f
        // cutter 1 number .F175 before .F2 -> .175 vs .2

        if (!cutter2) {
            if (cutter2Letter) {
                theTrimmings = cutter2Letter + theTrimmings;
                cutter2Letter = '';
            }
        }

        if (theTrimmings) {
            /* TESTING NEW SECTION TO HANDLE VOLUME & PART NUMBERS */
            integerMarkers.forEach(marker => {
                const exp2 = new RegExp(`(?<trimmingStart>.*)?(?<integerMarker>${marker})(\\.)?\\s*(?<integer>\\d+);(?<theRest>.*)?`, "i")
                const markerMatch = theTrimmings.match(exp2); // Apply regex on 'theTrimmings'

                if (markerMatch?.groups) { // Safely access groups
                    const {trimmingStart, integerMarker, integer, theRest} = markerMatch.groups;
                    const paddedInteger = integer.padStart(5, '0');
                    theTrimmings = `${trimmingStart ? trimmingStart : ""}${integerMarker}${paddedInteger}${theRest ? theRest : ""}`;
                }
            });

            theTrimmings = theTrimmings.replace(/(\.)(\d)/g, '$1 $2'); //Matches a period (.) followed by a digit, adds a space between
            theTrimmings = theTrimmings.replace(/(\d)\s*-\s*(\d)/g, '$1-$2'); // Matches two digits separated by a dash (-), with whitespace on either side, ensures no whitespace around the dash
            theTrimmings = theTrimmings.trimStart()

            theTrimmings = theTrimmings.replace("\\", "")
        }

        return `${initialLetters.padEnd(4, " ")} ${classNumber.padStart(5, "0")}${decimalNumber.padEnd(12, "0")} ${cutter1 ? cutter1Letter + cutter1Number.padEnd(7, "0") : "        "} ${cutter2 ? cutter2Letter + cutter2Number.padEnd(7, "0") : "        "} ${theTrimmings}`
    }

    private prepareCallNumber(originalLCNumber: string) {
        let lcCallNumber = originalLCNumber.toUpperCase();
        const integerMarkers = [
            "C.",
            "BD.",
            "DISC",
            "DISK",
            "PT.",
            "v.",
            "V.",
            "VOL.",
            "OP.",
            "NO."
        ]; // A number that follows one of these should be treated as an integer not a decimal.

        for (let mark of integerMarkers) {
            mark = mark.toUpperCase()
            mark = mark.replace(".", "\\."); // Escape the dot so it can be used as a regex pattern
            const regex = new RegExp(`${mark}(\\d+)`, "g");
            lcCallNumber = lcCallNumber.replace(regex, `${mark}$1;`); // Add a semicolon to distinguish it as an integer.
        }

        // Remove any initial white space
        lcCallNumber = lcCallNumber.trimStart()
        return {lcCallNumber, integerMarkers};
    }

    private sortDewey(right: PhysicalItem, left: PhysicalItem) {
        const rightCN = this.normalizeDewey(right.callNumber);
        const leftCN = this.normalizeDewey(left.callNumber);
        return rightCN.localeCompare(leftCN);
    }

    private normalizeDewey(callNum: string) {
        // Insert ! when lowercase letter comes after number
        let init = callNum.replace(/([0-9])(?=[a-z])/g, "$1!");
        // Make all characters lowercase... sort works better this way for dewey...
        init = init.toLowerCase();
        // Get rid of leading and trailing whitespace
        init = init.trimStart().trimEnd();
        // Remove all occurrences of '&'
        init = init.replace(/\&/g, "");
        // Remove all slashes
        init = init.replace(/\//g, "");
        // Remove all backslashes
        init = init.replace(/\\/g, "");
        // Replace newline characters
        init = init.replace(/\n/g, "");

        let digitGroupCount = 0;
        let firstDigitGroupIndex: number = -1;

        const tokens = init.split(/\.|\s+/g);

        for (let i = 0; i < tokens.length; i++) {
            if (/^\d+$/.test(tokens[i])) {
                // Increment the number of digit groups
                digitGroupCount++;

                // If it's the first digit group, store its index
                if (digitGroupCount === 1) {
                    firstDigitGroupIndex = i;
                }

                // If there is a second group of digits
                if (digitGroupCount === 2) {
                    // Check if the second digit group is right after the first one
                    if (i - firstDigitGroupIndex === 1) {
                        // Pad the second group to 15 characters with trailing zeros
                        tokens[i] = tokens[i].padEnd(15, "0");
                    } else {
                        // Otherwise, append 15 zeros to the first digit group
                        tokens[firstDigitGroupIndex] += "_000000000000000";
                    }
                }
            }
        }

        if (digitGroupCount === 1) {
            tokens[firstDigitGroupIndex] = "_000000000000000";
        }

        return tokens.join("_");
    }
}