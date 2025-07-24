import {TestBed} from '@angular/core/testing';

import {CallNumberService} from './call-number.service';
import {ProcessedPhysicalItem} from "./report.service";

const IN_CORRECT_ORDER = -1
const NEEDS_TO_BE_SWITCHED = 1

let getPhysicalItem = (callNum: string, description: string = null): ProcessedPhysicalItem => {
    return {
        barcode: "string",
        existsInAlma: true,
        source: "job",

        mmsId: "",
        holdingId: "",
        pid: "",

        title: "",
        callNumber: callNum,
        library: "",
        description: description ? description : null,
        location: "",
        itemMaterialType: "",
        policyType: "",
        status: "",
        processType: "",
        lastModifiedDate: 192399124,
        lastLoanDate: null,
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
        wasScannedIn: false,
        hasTempLocation: false
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

        describe("Should sort Dewey classification numbers correctly", () => {
            it ("Should sort ex1 correctly", () => {
                const a = getPhysicalItem('001.422 T593 2021')
                const b = getPhysicalItem("001.422 T593s 2021")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex2 correctly", () => {
                const a = getPhysicalItem('001.422 T593s 2021')
                const b = getPhysicalItem("001.4226 E93 2018")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex3 correctly", () => {
                const a = getPhysicalItem('005.133 F583 2005')
                const b = getPhysicalItem("006.6 K39")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex4 correctly", () => {
                const a = getPhysicalItem('150.1 H112')
                const b = getPhysicalItem("150.1 J72")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex5 correctly", () => {
                const a = getPhysicalItem('150.1 W831 Yb')
                const b = getPhysicalItem("150.19434 S628")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex6 correctly", () => {
                const a = getPhysicalItem('150.195 E68Yc')
                const b = getPhysicalItem("150.82 H236")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex7 correctly", () => {
                const a = getPhysicalItem('150.9 H685 2002')
                const b = getPhysicalItem("150.9 M678h")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex8 correctly", () => {
                const a = getPhysicalItem('150.92 H741h')
                const b = getPhysicalItem("150.922 M689 v.2")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex9 correctly", () => {
                const a = getPhysicalItem('150.922 M689')
                const b = getPhysicalItem("150.922 M689 v.2")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex10 correctly", () => {
                const a = getPhysicalItem('989.506 P398a3')
                const b = getPhysicalItem("989.506 V253")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort user example 1 correctly", () => {
                const a = getPhysicalItem('002 A963 2010')
                const b = getPhysicalItem("002 B724")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort ex11 correctly", () => {
                const a = getPhysicalItem('002 B724 2010')
                const b = getPhysicalItem("002 B724")

                let result = service.sortDewey(a, b, false)
                expect(result).toEqual(NEEDS_TO_BE_SWITCHED)
            })

            it ("Should sort with description", () => {
                const a = getPhysicalItem('980.03 A512', "v.10")
                const b = getPhysicalItem("980.03 A512", "v.3")

                let result = service.sortDewey(a, b, true)
                expect(result).toEqual(NEEDS_TO_BE_SWITCHED)
            })

            it ("Should sort with description", () => {
                const a = getPhysicalItem('977.6 F671', "v.I")
                const b = getPhysicalItem("977.6 F671", "v.II")

                let result = service.sortDewey(a, b, true)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort with description", () => {
                const a = getPhysicalItem('977 G786', "pt.1")
                const b = getPhysicalItem("977 G786", "pt.2")

                let result = service.sortDewey(a, b, true)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it ("Should sort with description just year", () => {
                const a = getPhysicalItem('973.924 N736w DVD', "")
                const b = getPhysicalItem("973.924 N736w DVD", "2009")

                let result = service.sortDewey(a, b, true)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })
        })

        describe("Should sort LOC Call Numbers Correctly", () => {
            it('Should sort American Literature', () => {
                const a = getPhysicalItem("PS3572.A387Z6 2004")
                const b = getPhysicalItem("PS3572.A39D66 2004")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })
            it('Should sort Literature', () => {
                const a = getPhysicalItem("PN3432.G6 1975")
                const b = getPhysicalItem("PN3433.4.B73 2007")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })
            it('Should sort Architecture', () => {
                const a = getPhysicalItem("NA31.W45 1976")
                const b = getPhysicalItem("NA105.F87")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it('Should sort Musicals', () => {
                const a = getPhysicalItem("M23.B4 op.7 2012")
                const b = getPhysicalItem("M23.B4 op.57 1981")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })
            it('Should Sort Journals', () => {
                const a = getPhysicalItem("QA1.A647 v.3")
                const b = getPhysicalItem("QA1.A647 v.27")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })

            it('Should Sort Misc 1', () => {
                const a = getPhysicalItem("QA76.7.C36 2013")
                const b = getPhysicalItem("QA76.73.C153Y48 2005")

                let result = service.sortLC(a, b, false)
                expect(result).toEqual(IN_CORRECT_ORDER)
            })
        })

    })

    describe("Should parse Call Numbers correctly", () => {

        describe("Should parse Dewey classification Numbers correctly", () => {
            it ('should parse full dewey number correctly', () => {
                const deweyNumber = "641.5092 B37 2022"
                const expectedResult = "641.5092000000_b  3700   _          _          _2022"
                expect(service.normalizeDewey(deweyNumber)).toEqual(expectedResult)
            })

            it ('should parse dewey number with cutter suffix correctly', () => {
                const deweyNumber = "001.422 T593s 2021"
                const expectedResult = "001.4220000000_t  5930s  _          _          _2021"
                expect(service.normalizeDewey(deweyNumber)).toEqual(expectedResult)
            })

            it ('should parse dewey number with very long decimal number correctly', () => {
                const deweyNumber = "028.70279739991453 C195 2020"
                const expectedResult = "028.7027973999_c  1950   _          _          _2020"
                expect(service.normalizeDewey(deweyNumber)).toEqual(expectedResult)
            })

            it("Should parse correctly with 3-letter cutter numbers", () => {
                const deweyNumber = "613.2 Sch84 a"
                const expectedResult = "613.2000000000_sch8400   _          _          _a"
                expect(service.normalizeDewey(deweyNumber)).toEqual(expectedResult)
            })

        })

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
            it('should parse call number correctly 1', () => {
                const result = service.normalizeLC("LB 2351.2 .P375 2011")
                expect(result).toEqual("LB   02351.20000000000 P3750000          2011")
            })
            it('should parse call number correctly 2', () => {
                const result = service.normalizeLC("LB 1062.2 .L47 2017")
                expect(result).toEqual("LB   01062.20000000000 L4700000          2017")
            })

        })
    })
});
