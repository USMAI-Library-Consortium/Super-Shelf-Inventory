import {Injectable} from "@angular/core";
import {ParseReportService, PhysicalItem} from "./parse-report.service";
import {ReplaySubject, Subscription} from "rxjs";
import * as XLSX from 'xlsx';
import {filter, map, take} from "rxjs/operators";

export interface ProcessedPhysicalItem extends PhysicalItem {
    hasProblem: boolean,
    callSort: string | null;
    actualLocation: number | null,
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
    library: string,
    circDesk: string,
    reportOnlyProblems: boolean,
    orderProblemLimit: string,
    orderProblemCount: number,
    temporaryLocationProblemCount: number,
    libraryProblemCount: number,
    requestProblemCount: number,
    policyProblemCount: number,
    typeProblemCount: number,
    locationProblemCount: number,
    notInPlaceProblemCount: number,
    firstCallNum: string,
    lastCallNum: string,
    markAsInventoriedField: string | null,
    scanInItems: boolean,
    items: ProcessedPhysicalItem[]
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
        markAsInventoriedField: string | null,
        scanInItems: boolean,
        circDeskCode: string | null,
        scanDate: number
    ) {
        this.reportProcessed$.next(null)
        this.physicalItemsSubscription = this.prs.getParsedPhysicalItemsOnce().pipe(map(data => {
            return JSON.parse(JSON.stringify(data))
        })).subscribe(physicalItems => {
            let orderProblemCount = 0
            let tempProblemCount = 0
            let locationProblemCount = 0
            let libraryProblemCount = 0
            let requestProblemCount = 0
            let policyProblemCount = 0
            let typeProblemCount = 0
            let notInPlaceProblemCount = 0
            const unsorted: ProcessedPhysicalItem[] = []

            physicalItems.map(physicalItem => {
                const processedPhysicalItem: ProcessedPhysicalItem = {
                    ...physicalItem,
                    hasProblem: false,
                    callSort: null,
                    actualLocation: null,
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
            }).forEach((item, i) => {
                if (item.existsInAlma) {
                    if (!item.callNumber) item.callNumber = "";
                    // Barcode was found so we can store a normalized call number to use for sorting.

                    if (item.itemMaterialType && item.itemMaterialType == "DVD") {
                        item.callNumber = item.callNumber.replace(/^DVD\s*/, "")
                    }

                    if (callNumberType == "Dewey") item.callSort = this.normalizeDewey(item.callNumber);
                    else item.callSort = this.normalizeLC(item.callNumber)
                    console.log(item.callSort)
                }

                if (item.lastModifiedDate < scanDate && item.status === "Item not in place") {
                    item.needsToBeScannedIn = true
                    console.log(`Item ${item.barcode} needs to be scanned in `)
                }
                item.actualLocation = i + 1
                unsorted.push(item)
            })

            const firstItem = unsorted[0]
            const lastItem = unsorted[unsorted.length - 1]
            const firstCallNum = firstItem.callNumber.replace(".", "").replace(" ", "")
            const lastCallNum = lastItem.callNumber.replace(".", "").replace(" ", "")

            // Create a sorted array.
            const sorted = [...unsorted].sort(callNumberType === "Dewey" ? this.sortDewey : this.sortLC)

            sorted.forEach((item, index) => {

                // Flag order issues unless "Only problems other than CN Order" is requested
                if (orderProblemLimit !== "onlyOther") {
                    const actualLocationIndex = item.actualLocation - 1
                    const itemIsInTheCorrectAbsolutePosition = index === actualLocationIndex

                    const correctPreviousItemCallNum = index > 0 ? sorted[index - 1].callNumber : "LOCATION START"
                    const correctNextItemCallNum = index < sorted.length - 1 ? sorted[index + 1].callNumber : "LOCATION END"

                    // Get actual previous call number based on actualLocation
                    const actualPreviousItemCallNum = actualLocationIndex > 0 ? unsorted[actualLocationIndex - 1].callNumber : "LOCATION START";
                    // Get actual next call number based on actualLocation
                    const actualNextItemCallNumber = actualLocationIndex < unsorted.length - 1 ? unsorted[actualLocationIndex + 1].callNumber : "LOCATION END";

                    const previousItemIsAlreadyCorrect = actualPreviousItemCallNum === correctPreviousItemCallNum
                    const nextItemIsAlreadyCorrect = actualNextItemCallNumber === correctNextItemCallNum

                    const itemInCorrectRelativePosition = previousItemIsAlreadyCorrect && nextItemIsAlreadyCorrect

                    if (!itemIsInTheCorrectAbsolutePosition) {
                        if (itemInCorrectRelativePosition) {
                            item.hasOrderProblem = "**Out Of Order section continued**"
                        }

                        const isRogueItem = !previousItemIsAlreadyCorrect && !nextItemIsAlreadyCorrect
                        if (isRogueItem) {
                            item.hasOrderProblem = `**OUT OF ORDER**; should be between '${correctPreviousItemCallNum}' and '${correctNextItemCallNum}'`
                        }

                        const isFirstItemOfBadSection = !previousItemIsAlreadyCorrect && nextItemIsAlreadyCorrect
                        if (isFirstItemOfBadSection) {
                            item.hasOrderProblem = `**OUT OF ORDER SECTION START**; should be after '${correctPreviousItemCallNum}'`
                        }

                        const isLastItemOfBadSection = previousItemIsAlreadyCorrect && !nextItemIsAlreadyCorrect
                        if (isLastItemOfBadSection) {
                            item.hasOrderProblem = `**OUT OF ORDER SECTION END**; next item should be '${correctNextItemCallNum}'`
                        }
                        item.hasProblem = true;
                        orderProblemCount += 1
                    }
                } // Finished calculating order issues

                // Flag other issues unless "Only CN Order problems" is requested.
                if (orderProblemLimit !== "onlyOrder") {
                    // Does not calculate wrong call number issues.

                    if (item.status !== "Item in place") {
                        item.hasProblem = true
                        item.hasNotInPlaceProblem = `**Not In Place: ${item.processType}**`
                        notInPlaceProblemCount += 1
                    }

                    if (item.inTempLocation) {
                        item.hasProblem = true
                        item.hasTemporaryLocationProblem = "**IN TEMP LOC**"
                        tempProblemCount += 1
                    }

                    if (item.requested) {
                        item.hasProblem = true
                        item.hasRequestProblem = "**ITEM HAS REQUEST**"
                        requestProblemCount += 1
                    }

                    if (!locationCodes.includes(item.location)) {
                        item.hasProblem = true
                        item.hasLocationProblem = `**WRONG LOCATION: ${item.location}; expected any of [${locationCodes.join(", ")}]**`
                        locationProblemCount += 1
                    }

                    if (item.library !== libraryCode) {
                        item.hasProblem = true
                        item.hasLibraryProblem = `**WRONG LIBRARY: ${item.library}; expected ${libraryCode}**`
                        libraryProblemCount += 1
                    }

                    if (expectedPolicyTypes.length > 0 && !expectedPolicyTypes.includes(item.policyType)) {
                        if (item.policyType != "") {
                            item.hasPolicyProblem = `**WRONG ITEM POLICY: ${item.policyType}; expected ${expectedPolicyTypes}**`
                        } else {
                            item.hasPolicyProblem = "**BLANK ITEM POLICY**"
                        }
                        item.hasProblem = true
                        policyProblemCount += 1
                    }

                    if (expectedItemTypes.length > 0 && !expectedItemTypes.includes(item.itemMaterialType)) {
                        if (item.itemMaterialType !== "") {
                            item.hasTypeProblem = `**WRONG TYPE: ${item.itemMaterialType}; expected any of [${expectedItemTypes.join(", ")}]**`
                        } else {
                            item.hasTypeProblem = "**BLANK ITEM MATERIAL TYPE**"
                        }
                        item.hasProblem = true
                        typeProblemCount += 1
                    }


                } // Finished calculating non-order-related issues

                item.correctLocation = index + 1
            })

            const outputFilename = `Shelflist_${libraryCode}_${locationCodes.join("_")}_${firstCallNum.substring(0, 4)}_${lastCallNum.substring(0, 4)}_${new Date().toISOString().slice(0, 10)}.xlsx`
            this.reportProcessed$.next({
                outputFilename,
                library: libraryCode,
                circDesk: circDeskCode,
                reportOnlyProblems,
                orderProblemLimit,
                orderProblemCount,
                temporaryLocationProblemCount: tempProblemCount,
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
                items: sortBy === "actualOrder" ? unsorted : sorted
            })
        })

    }

    generateExcel(reportData: ReportData) {
        const formattedReport = reportData.items.filter((item) => {
            if (reportData.reportOnlyProblems) {
                return item.hasProblem
            } else return true
        }).map(item => {
            let reportCols: object = {
                "Barcode": item.barcode,
                "Correct Position": item.correctLocation,
                "Actual Position": item.actualLocation,
                "Call Number": item.callNumber,
                "Normalized Call Number": item.callSort,
                "Title": item.title,
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

        // Set column widths
        worksheet['!cols'] = [
            {wch: 15},  // Barcode column width
            {wch: 15},  // Correct Position column width
            {wch: 15},  // Actual Position column width
            {wch: 25},  // Call Number column width
            {wch: 30},  // Normalized Call Number column width
            {wch: 50},  // Title column width
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

    public sortLC = (a: PhysicalItem, b: PhysicalItem) => {
        const aCN = this.normalizeLC(a.callNumber)
        const bCN = this.normalizeLC(b.callNumber)
        return aCN.localeCompare(bCN)
    }

    public normalizeLC(originalLCNumber: string) {
        /*
          User defined setting: set problems to top to sort unparsable
          call numbers to the top of the list; false to sort them to the
          bottom.
        */
        const problemsToTop = true;
        const unparsable = problemsToTop ? " " : "~";

        let lcCallNumber = originalLCNumber.toUpperCase();
        const integerMarkers = [
            "C.",
            "BD.",
            "DISC",
            "DISK",
            "NO.",
            "PT.",
            "v.",
            "V.",
            "VOL.",
            "OP."
        ]; // A number that follows one of these should be treated as an integer not a decimal.

        for (let mark of integerMarkers) {
            mark = mark.toUpperCase()
            mark = mark.replace(".", "\\."); // Escape the dot so it can be used as a regex pattern
            const regex = new RegExp(`${mark}(\\d+)`, "g");
            lcCallNumber = lcCallNumber.replace(regex, `${mark}$1;`); // Add a semicolon to distinguish it as an integer.
        }

        // Remove any initial white space
        lcCallNumber = lcCallNumber.trimStart()

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
