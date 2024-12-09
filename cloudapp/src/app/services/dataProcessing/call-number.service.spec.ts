import {TestBed} from '@angular/core/testing';

import {CallNumberService} from './call-number.service';
import {ProcessedPhysicalItem} from "./report.service";

let getPhysicalItem = (callNum: string): ProcessedPhysicalItem => {
    return {
        barcode: "string",
        existsInAlma: true,

        mmsId: "",
        holdingId: "",
        pid: "",

        title: "",
        callNumber: callNum,
        library: "",
        description: "",
        location: "",
        itemMaterialType: "",
        policyType: "",
        status: "",
        processType: "",
        lastModifiedDate: "192399124",
        inTempLocation: false,
        requested: false,

        hasProblem: false,
        callSort: null,
        normalizedDescription: null,
        sortable: true,
        actualLocation: null,
        actualLocationInUnsortablesRemoved: null,
        correctLocation: null,
        hasOrderProblem: null,
        hasTemporaryLocationProblem: null,
        hasLibraryProblem: null,
        hasLocationProblem: null,
        hasNotInPlaceProblem: null,
        hasPolicyProblem: null,
        hasRequestProblem: null,
        hasTypeProblem: null,
        needsToBeScannedIn: false,
        wasScannedIn: false
    }
}

describe('CallNumberService', () => {
    let service: CallNumberService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(CallNumberService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe("Should sort Call Numbers correctly", () => {
        describe("Should sort LOC Call Numbers Correctly", () => {
            it('Should sort American Literature', () => {
                const a = getPhysicalItem("PS3572.A387Z6 2004")
                const b = getPhysicalItem("PS3572.A39D66 2004")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(-1)
            })
            it('Should sort Literature', () => {
                const a = getPhysicalItem("PN3432.G6 1975")
                const b = getPhysicalItem("PN3433.4.B73 2007")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(-1)
            })
            it('Should sort Architecture', () => {
                const a = getPhysicalItem("NA31.W45 1976")
                const b = getPhysicalItem("NA105.F87")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(-1)
            })

            it('Should sort Musicals', () => {
                const a = getPhysicalItem("M23.B4 op.7 2012")
                const b = getPhysicalItem("M23.B4 op.57 1981")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(-1)
            })
            it('Should Sort Journals', () => {
                const a = getPhysicalItem("QA1.A647 v.3")
                const b = getPhysicalItem("QA1.A647 v.27")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(-1)
            })

            it('Should Sort Misc 1', () => {
                const a = getPhysicalItem("QA76.7.C36 2013")
                const b = getPhysicalItem("QA76.73.C153Y48 2005")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(-1)
            })
        })

    })

    describe("Should parse Call Numbers correctly", () => {
        describe("Should parse LOC Call Numbers correctly", () => {
            it('Parse American Literature call num', () => {
                const result = service.normalizeLC("PS3572.A39D66 2004")
                expect(result).toEqual("PS   03572.00000000000 A3900000 D6600000 2004", result)
            })
            it('Parse call number no decimal', () => {
                const result = service.normalizeLC("HF 1452 D54 1993")
                expect(result).toEqual("HF   01452.00000000000 D5400000          1993", result)
            })
            it('Parse call number no decimal with letter after cutter number', () => {
                const result = service.normalizeLC("HF 1416 P73X 2006")
                expect(result).toEqual("HF   01416.00000000000 P73X0000          2006", result)
            })
            it('Parse call number with cutter number suffix', () => {
                const result = service.normalizeLC("HF 1417.5 M85X 1989")
                expect(result).toEqual("HF   01417.50000000000 M85X0000          1989", result)
            })

            it('Parse call number with cutter number suffix and multiple cutters', () => {
                const result = service.normalizeLC("HF 1456.5 E825 F42X 1996")
                expect(result).toEqual("HF   01456.50000000000 E8250000 F42X0000 1996", result)
            })

            it('Parse call number with cutter number suffix with two letters', () => {
                const result = service.normalizeLC("HF 1417.5 M85XB 1989")
                expect(result).toEqual("HF   01417.50000000000 M85XB000          1989", result)
            })

        })
    })
});
