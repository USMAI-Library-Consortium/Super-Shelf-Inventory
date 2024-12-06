import { Injectable } from '@angular/core';
import {PhysicalItem} from "../fileParsing/parse-report.service";
import {ProcessedPhysicalItem} from "./report.service";

@Injectable({
  providedIn: 'root'
})
export class CallNumberService {

  constructor() { }

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

    integerMarkers.push("n")
    integerMarkers.forEach(marker => {
      marker = marker.toUpperCase()
      // const exp2 = new RegExp(`(?<prefix>.*)?(?<integerMarker1>${marker})(\\.)?\\s*(?<integer1>\\d+).*(?<secondVol>(?<integerMarker2>${marker})(\\.)?\\s*(?<integer2>\\d+))?.*(?<date1>\\d{4}).*(?<date2>\\d{4})?.*`, "i")
      // const markerMatch = normalizedDescription.match(exp2); // Apply regex on 'theTrimmings'
      //
      // if (markerMatch?.groups) { // Safely access groups
      //     const {prefix, integerMarker1, integer1, integerMarker2, integer2, secondVol, date1, date2} = markerMatch.groups;
      //     const paddedInteger1 = integer1.padStart(5, '0');
      //     description = `${prefix ? prefix + " ": ""}${integerMarker1} ${paddedInteger1} ${secondVol ? integerMarker2 + " " + integer2.padStart(5, "0") + " " : ""}${date1 ? date1 : ""} ${date2 ? date2 : ""}`;
      // }

      description = description.replace(new RegExp(`(?<integerMarker>${marker})\\.?\\s*(?<integer>\\d+)`, "gi"), (match, integerMarker, integer) => {
        return `${marker}${integer.padStart(5, "0")}`
      })
    });

    description = description.replace("\\", "")
    description = description.replace(/\s{2,}/, " ")
    description = description.replace(/(\d)\s*-\s*(\d)/g, '$1-$2');

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

    const lcRegex = /^(?<initialLetters>[A-Z]{1,4})\s*(?<classNumber>\d+)\s*(?<decimalNumber>\.?\d*)\s*(?<cutter1>\.*\s*(?<cutter1Letter>[A-Z])(?<cutter1Number>\d+)(?<cutter1Suffix>[A-Z] )?)?\s*(?<cutter2>(?<cutter2Letter>[A-Z])(?<cutter2Number>\d+)(?<cutter2Suffix>[A-Z] )?)?\s*(?<theTrimmings>.*)$/;
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
      cutter1Suffix,
      cutter2,
      cutter2Letter,
      cutter2Number,
      cutter2Suffix,
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

    if (!decimalNumber.startsWith(".")) {
      decimalNumber = "." + decimalNumber;
    }

    if (!cutter2) {
      if (cutter2Letter) {
        theTrimmings = cutter2Letter + theTrimmings;
        cutter2Letter = '';
      }
    }

    if (theTrimmings) {
      /* TESTING NEW SECTION TO HANDLE VOLUME & PART NUMBERS */
      integerMarkers.forEach(marker => {
        const exp2 = new RegExp(`(?<trimmingStart>.*)?(?<integerMarker>${marker})(\\.)?\\s*(?<integer>\\d+);?(?<theRest>.*)?`, "i")
        const markerMatch = theTrimmings.match(exp2); // Apply regex on 'theTrimmings'

        if (markerMatch?.groups) { // Safely access groups
          const {trimmingStart, integerMarker, integer, theRest} = markerMatch.groups;
          const paddedInteger = integer.padStart(5, '0');
          theTrimmings = `${trimmingStart ? trimmingStart : ""}${integerMarker === "VOL" ? "V" : integerMarker}${paddedInteger}${theRest ? theRest : ""}`;
        }
      });

      // theTrimmings = theTrimmings.replace(/(\.)(\d)/g, '$1 $2'); //Matches a period (.) followed by a digit, adds a space between
      theTrimmings = theTrimmings.replace(/(\d)\s*-\s*(\d)/g, '$1-$2'); // Matches two digits separated by a dash (-), with whitespace on either side, ensures no whitespace around the dash
      theTrimmings = theTrimmings.trimStart()

      theTrimmings = theTrimmings.replace("\\", "")
    }

    if (!cutter1Suffix) cutter1Suffix = ""
    if (!cutter2Suffix) cutter2Suffix = ""
    cutter1Suffix = cutter1Suffix.trimEnd()
    cutter2Suffix = cutter2Suffix.trimEnd()
    return `${initialLetters.padEnd(4, " ")} ${classNumber.padStart(5, "0")}${decimalNumber.padEnd(12, "0")} ${cutter1 ? cutter1Letter + (cutter1Number + cutter1Suffix).padEnd(7, "0") : "        "} ${cutter2 ? cutter2Letter + (cutter2Number + cutter2Suffix).padEnd(7, "0") : "        "} ${theTrimmings}`
  }

  private prepareCallNumber(originalLCNumber: string) {
    let lcCallNumber = originalLCNumber.toUpperCase();
    const integerMarkers = [
      "C",
      "BD",
      "DISC",
      "DISK",
      "PT",
      "V",
      "VOL",
      "OP",
      "NO"
    ]; // A number that follows one of these should be treated as an integer not a decimal.

    // for (let mark of integerMarkers) {
    //     mark = mark.toUpperCase()// Escape the dot so it can be used as a regex pattern
    //     const regex = new RegExp(`${mark}(\\d+)`, "g");
    //     lcCallNumber = lcCallNumber.replace(regex, `${mark}$1;`); // Add a semicolon to distinguish it as an integer.
    // }

    // Remove any initial white space
    lcCallNumber = lcCallNumber.trimStart()
    return {lcCallNumber, integerMarkers};
  }

  public sortDewey(right: PhysicalItem, left: PhysicalItem) {
    const rightCN = this.normalizeDewey(right.callNumber);
    const leftCN = this.normalizeDewey(left.callNumber);
    return rightCN.localeCompare(leftCN);
  }

  public normalizeDewey(callNum: string) {
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
