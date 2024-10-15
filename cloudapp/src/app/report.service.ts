import {Injectable} from "@angular/core";
import {ParseReportService, PhysicalItem} from "./parse-report.service";
import {ReplaySubject, Subscription} from "rxjs";
import * as XLSX from 'xlsx';

export interface ProcessedPhysicalItem extends PhysicalItem {
  hasProblem: boolean,
  callSort: string | null;
  actualLocation: number | null,
  correctLocation: number | null,
  problemList: string[]
}

interface ReportData {
  outputFilename: string,
  reportOnlyProblems: boolean,
  orderProblemCount: number,
  tempProblemCount: number,
  libraryProblemCount: number,
  requestProblemCount: number,
  policyProblemCount: number,
  typeProblemCount: number,
  firstCallNum: string,
  lastCallNum: string,
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

  reset() {
    this.physicalItemsSubscription.unsubscribe()
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
  ) {
    this.physicalItemsSubscription = this.prs.getParsedPhysicalItemsOnce().subscribe(physicalItems => {
      let orderProblemCount = 0
      let tempProblemCount = 0
      let locationProblemCount = 0
      let libraryProblemCount = 0
      let requestProblemCount = 0
      let policyProblemCount = 0
      let typeProblemCount = 0
      const unsorted: ProcessedPhysicalItem[] = []

      let rowNum = 1
      physicalItems.map(physicalItem => {
        const processedPhysicalItem: ProcessedPhysicalItem = {
          ...physicalItem,
          hasProblem: false,
          callSort: null,
          actualLocation: null,
          correctLocation: null,
          problemList: []
        }
        return processedPhysicalItem
      }).forEach(item => {
        if (item.existsInAlma) {
          if (!item.callNumber) item.callNumber = "";
          // Barcode was found so we can store a normalized call number to use for sorting.

          if (item.itemMaterialType && item.itemMaterialType == "DVD") {
            item.callNumber = item.callNumber.replace(/^DVD\s*/, "")
          }

          if (callNumberType == "Dewey") item.callSort = this.normalizeDewey(item.callNumber);
          else item.callSort = this.normalizeLC(item.callNumber)
        }
        item.actualLocation = rowNum
        unsorted.push(item)
        rowNum += 1
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
              item.problemList.push("**Bad section continued**")
            }

            const isRogueItem = !previousItemIsAlreadyCorrect && !nextItemIsAlreadyCorrect
            if (isRogueItem) {
              item.problemList.push(`**OUT OF ORDER**; should be between '${correctPreviousItemCallNum}' and '${correctNextItemCallNum}'`)
            }

            const isFirstItemOfBadSection = !previousItemIsAlreadyCorrect && nextItemIsAlreadyCorrect
            if (isFirstItemOfBadSection) {
              item.problemList.push(`**OUT OF ORDER - BAD SECTION START**; should be after '${correctPreviousItemCallNum}'`)
            }

            const isLastItemOfBadSection = previousItemIsAlreadyCorrect && !nextItemIsAlreadyCorrect
            if (isLastItemOfBadSection) {
              item.problemList.push(`**OUT OF ORDER - END BAD SECTION**; next item should be '${correctNextItemCallNum}'`)
            }
            item.hasProblem = true;
          }
        } // Finished calculating order issues

        // Flag other issues unless "Only CN Order problems" is requested.
        if (orderProblemLimit !== "onlyOrder") {
          // Does not calculate wrong call number issues.
          if (item.status !== "Item in place") {
            item.hasProblem = true
            item.problemList.push(`**Not In Place: ${item.processType}**`)
          }

          if (item.inTempLocation) {
            item.hasProblem = true
            item.problemList.push("**IN TEMP LOC**")
            tempProblemCount += 1
          }

          if (item.requested) {
            item.hasProblem = true
            item.problemList.push("**ITEM HAS REQUEST**")
            requestProblemCount += 1
          }

          if (!locationCodes.includes(item.location)) {
            item.hasProblem = true
            item.problemList.push(`**WRONG LOCATION: ${item.location}; expected any of [${locationCodes.join(", ")}]**`)
            locationProblemCount += 1
          }

          if (item.library !== libraryCode) {
            item.hasProblem = true
            item.problemList.push(`**WRONG LIBRARY: ${item.library}; expected ${libraryCode}**`)
            libraryProblemCount += 1
          }

          if (expectedPolicyTypes.length > 0 && !expectedPolicyTypes.includes(item.policyType)) {
            if (item.policyType != "") {
              item.problemList.push(`**WRONG ITEM POLICY: ${item.policyType}; expected ${expectedPolicyTypes}**`)
            } else {
              item.problemList.push("**BLANK ITEM POLICY**")
            }
            item.hasProblem = true
            policyProblemCount += 1
          }

          if (expectedItemTypes.length > 0 && !expectedItemTypes.includes(item.itemMaterialType)) {
            if (item.itemMaterialType !== "") {
              item.problemList.push(`**WRONG TYPE: ${item.itemMaterialType}; expected any of [${expectedItemTypes.join(", ")}]**`)
            } else {
              item.problemList.push("**BLANK ITEM MATERIAL TYPE**")
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
        reportOnlyProblems,
        orderProblemCount,
        tempProblemCount,
        libraryProblemCount,
        requestProblemCount,
        policyProblemCount,
        typeProblemCount,
        firstCallNum,
        lastCallNum,
        items: sortBy === "actualOrder" ? unsorted : sorted
      })
    })

  }

  generateExcel(reportData: ReportData) {
    const formattedReport = reportData.items.map(item => {
      return {
        "Barcode": item.barcode,
        "Correct Position": item.correctLocation,
        "Actual Position": item.actualLocation,
        "Call Number": item.callNumber,
        "Normalized Call Number": item.callSort,
        "Title": item.title,
        "Problems": item.problemList.join(", ")
      }
    }).filter(row => {
      if (reportData.reportOnlyProblems && !row["Problems"]) return null
      return row
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
      {wch: 50},  // Problems column width
    ];

    const workbook: XLSX.WorkBook = {
      Sheets: {'Sheet1': worksheet},
      SheetNames: ['Sheet1'],
    };

    XLSX.writeFile(workbook, reportData.outputFilename);
  }

  private sortLC = (right: PhysicalItem, left: PhysicalItem) => {
    const rightCN = this.normalizeLC(right.callNumber)
    const leftCN = this.normalizeLC(left.callNumber)
    return rightCN.localeCompare(leftCN)
  }

  private normalizeLC(originalLCNumber: string) {
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
    ];

    for (let mark of integerMarkers) {
      mark = mark.replace(".", "\\."); // Escape the dot for regex
      const regex = new RegExp(`${mark}(\\d+)`, "g"); // Create the regex pattern
      lcCallNumber = lcCallNumber.replace(regex, `${mark}$1;`); // Replace matches
    }
    // Remove any inital white space
    lcCallNumber = lcCallNumber.trimStart()

    const lcRegex = /^([A-Z]{1,3})\s*(\d+)\s*\.*(\d*)\s*\.*\s*([A-Z]*)(\d*)\s*([A-Z]*)(\d*)\s*(.*)$/;
    const match = lcCallNumber.match(lcRegex);
    if (!match) return unparsable // return extreme answer if not a call number

    // Process the extracted variables as needed
    // Return or do something with the parsed data
    const initialLetters = match[1];
    let classNumber = match[2];
    let decimalNumber = match[3];
    const cutter1Letter = match[4];
    let cutter1Number = match[5];
    let cutter2Letter = match[6];
    let cutter2Number = match[7];
    let theTrimmings = match[8];

    if (cutter2Letter && !cutter2Number) {
      theTrimmings = cutter2Letter + theTrimmings;
      cutter2Letter = '';
    }

    /* TESTING NEW SECTION TO HANDLE VOLUME & PART NUMBERS */
    integerMarkers.forEach(marker => {
      const exp = `/(.*)(${marker})(\d+)(.*)/`
      const markerMatch = marker.match(exp)

      if (markerMatch) {
        const trimStart = markerMatch[1];
        const intMark = markerMatch[2];
        const trimRest = markerMatch[4];

        let intNo = markerMatch[3];
        intNo = intNo.padStart(5, ' ');
        theTrimmings = trimStart + intMark + intNo + trimRest;
      }
    })

    if (classNumber) classNumber = classNumber.padStart(5, " ");
    if (decimalNumber) decimalNumber = decimalNumber.padEnd(12, ' ');
    if (cutter1Number) cutter1Number = ` ${cutter1Number}`;
    if (cutter2Letter) cutter2Letter = `   ${cutter2Letter}`;
    if (cutter2Number) cutter2Number = ` ${cutter2Number}`;

    if (theTrimmings) {
      theTrimmings = theTrimmings.replace(/(\.)(\d)/g, '$1 $2');
      theTrimmings = theTrimmings.replace(/(\d)\s*-\s*(\d)/g, '$1-$2');
      theTrimmings = `   ${theTrimmings}`;
    }

    return initialLetters + classNumber + decimalNumber + cutter1Letter + cutter1Number + cutter2Letter
        + cutter2Number + theTrimmings;
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
