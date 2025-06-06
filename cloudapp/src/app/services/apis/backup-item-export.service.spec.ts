


import { TestBed } from '@angular/core/testing';

import { BackupItemExportService } from './backup-item-export.service';

const test_item_in_main_location = {
    "bib_data": {
        "title": "Egyptian art in the age of the pyramids.",
        "author": "Galeries nationales du Grand Palais (France)",
        "isbn": "9780810965430",
        "mms_id": "990025035300108250",
        "bib_suppress_from_publishing": "false",
        "complete_edition": "",
        "network_number": [
            "LN282268",
            "SM0000196081",
            "SS0041431623",
            "TS0041431623",
            "CP0041431623",
            "(OCoLC)41431623",
            "(Aleph)002503530MAI01",
            "(EXLNZ-01USMAI_NETWORK)9910103507308236"
        ],
        "place_of_publication": "New York :",
        "date_of_publication": "©1999.",
        "publisher_const": "Distributed by HN Abrams",
        "link": "/almaws/v1/bibs/990025035300108250"
    },
    "holding_data": {
        "holding_id": "2252160850008250",
        "holding_suppress_from_publishing": "false",
        "calculated_suppress_from_publishing": "false",
        "permanent_call_number_type": {
            "value": "0",
            "desc": "Library of Congress classification"
        },
        "permanent_call_number": "N5350 .E37 1999",
        "call_number_type": {
            "value": "0",
            "desc": "Library of Congress classification"
        },
        "call_number": "N5350 .E37 1999",
        "accession_number": "",
        "copy_id": "",
        "in_temp_location": false,
        "temp_library": {},
        "temp_location": {},
        "temp_call_number_type": {
            "value": ""
        },
        "temp_call_number": "",
        "temp_call_number_source": "",
        "temp_policy": {
            "value": ""
        },
        "link": "/almaws/v1/bibs/990025035300108250/holdings/2252160850008250"
    },
    "item_data": {
        "pid": "2352160840008250",
        "barcode": "32061002170995",
        "policy": {
            "value": "01",
            "desc": "30-Day Lost (ALEPH 01)"
        },
        "provenance": {
            "value": "SUHOL",
            "desc": "SUHOL"
        },
        "description": "",
        "library": {
            "value": "SU-SU",
            "desc": "SU Guerrieri Academic Commons"
        },
        "location": {
            "value": "STACK",
            "desc": "Stacks"
        },
        "pages": "",
        "pieces": "",
        "requested": false,
        "creation_date": "2002-06-13Z",
        "modification_date": "2018-03-11Z",
        "base_status": {
            "value": "1",
            "desc": "Item in place"
        },
        "awaiting_reshelving": false,
        "physical_material_type": {
            "value": "BOOK",
            "desc": "Book"
        },
        "po_line": "",
        "is_magnetic": false,
        "arrival_date": "2002-06-14Z",
        "year_of_issue": "",
        "enumeration_a": "",
        "enumeration_b": "",
        "enumeration_c": "",
        "enumeration_d": "",
        "enumeration_e": "",
        "enumeration_f": "",
        "enumeration_g": "",
        "enumeration_h": "",
        "chronology_i": "",
        "chronology_j": "",
        "chronology_k": "",
        "chronology_l": "",
        "chronology_m": "",
        "break_indicator": {
            "value": ""
        },
        "pattern_type": {
            "value": ""
        },
        "linking_number": "",
        "type_of_unit": "",
        "receiving_operator": "import",
        "process_type": {
            "value": ""
        },
        "inventory_number": "",
        "inventory_price": "50.00",
        "alternative_call_number": "",
        "alternative_call_number_type": {
            "value": ""
        },
        "storage_location_id": "",
        "public_note": "",
        "fulfillment_note": "",
        "internal_note_1": "",
        "internal_note_2": "",
        "internal_note_3": "",
        "statistics_note_1": "",
        "statistics_note_2": "",
        "statistics_note_3": "",
        "physical_condition": {},
        "committed_to_retain": {
            "value": "true",
            "desc": "Yes"
        },
        "retention_reason": {
            "value": ""
        },
        "retention_note": "EAST retention item"
    },
    "link": "/almaws/v1/bibs/990025035300108250/holdings/2252160850008250/items/2352160840008250"
}

const test_item_in_temp_location = {
    "bib_data": {
        "title": "Egyptian art in the age of the pyramids.",
        "author": "Galeries nationales du Grand Palais (France)",
        "isbn": "9780810965430",
        "mms_id": "990025035300108250",
        "bib_suppress_from_publishing": "false",
        "complete_edition": "",
        "network_number": [
            "LN282268",
            "SM0000196081",
            "SS0041431623",
            "TS0041431623",
            "CP0041431623",
            "(OCoLC)41431623",
            "(Aleph)002503530MAI01",
            "(EXLNZ-01USMAI_NETWORK)9910103507308236"
        ],
        "place_of_publication": "New York :",
        "date_of_publication": "©1999.",
        "publisher_const": "Distributed by HN Abrams",
        "link": "/almaws/v1/bibs/990025035300108250"
    },
    "holding_data": {
        "holding_id": "2252160850008250",
        "holding_suppress_from_publishing": "false",
        "calculated_suppress_from_publishing": "false",
        "permanent_call_number_type": {
            "value": "0",
            "desc": "Library of Congress classification"
        },
        "permanent_call_number": "N5350 .E37 1999",
        "call_number_type": {
            "value": "0",
            "desc": "Library of Congress classification"
        },
        "call_number": "N5350 .E37 1999",
        "accession_number": "",
        "copy_id": "",
        "in_temp_location": true,
        "temp_library": {
            "value": "SU-SU",
            "desc": "SU Guerrieri Academic Commons"
        },
        "temp_location": {
            "value": "STACK",
            "desc": "Stacks"
        },
        "temp_call_number_type": {
            "value": ""
        },
        "temp_call_number": "",
        "temp_call_number_source": "",
        "temp_policy": {
            "value": "01"
        },
        "link": "/almaws/v1/bibs/990025035300108250/holdings/2252160850008250"
    },
    "item_data": {
        "pid": "2352160840008250",
        "barcode": "32061002170995",
        "policy": {
            "value": "01",
            "desc": "30-Day Lost (ALEPH 01)"
        },
        "provenance": {
            "value": "SUHOL",
            "desc": "SUHOL"
        },
        "description": "",
        "library": {
            "value": "SU-MA",
            "desc": "SU Madison Academic Library"
        },
        "location": {
            "value": "COLL",
            "desc": "Special Collections"
        },
        "pages": "",
        "pieces": "",
        "requested": false,
        "creation_date": "2002-06-13Z",
        "modification_date": "2018-03-11Z",
        "base_status": {
            "value": "1",
            "desc": "Item in place"
        },
        "awaiting_reshelving": false,
        "physical_material_type": {
            "value": "BOOK",
            "desc": "Book"
        },
        "po_line": "",
        "is_magnetic": false,
        "arrival_date": "2002-06-14Z",
        "year_of_issue": "",
        "enumeration_a": "",
        "enumeration_b": "",
        "enumeration_c": "",
        "enumeration_d": "",
        "enumeration_e": "",
        "enumeration_f": "",
        "enumeration_g": "",
        "enumeration_h": "",
        "chronology_i": "",
        "chronology_j": "",
        "chronology_k": "",
        "chronology_l": "",
        "chronology_m": "",
        "break_indicator": {
            "value": ""
        },
        "pattern_type": {
            "value": ""
        },
        "linking_number": "",
        "type_of_unit": "",
        "receiving_operator": "import",
        "process_type": {
            "value": "Work Order"
        },
        "inventory_number": "",
        "inventory_price": "50.00",
        "alternative_call_number": "",
        "alternative_call_number_type": {
            "value": ""
        },
        "storage_location_id": "",
        "public_note": "",
        "fulfillment_note": "",
        "internal_note_1": "",
        "internal_note_2": "",
        "internal_note_3": "",
        "statistics_note_1": "",
        "statistics_note_2": "",
        "statistics_note_3": "",
        "physical_condition": {},
        "committed_to_retain": {
            "value": "true",
            "desc": "Yes"
        },
        "retention_reason": {
            "value": ""
        },
        "retention_note": "EAST retention item"
    },
    "link": "/almaws/v1/bibs/990025035300108250/holdings/2252160850008250/items/2352160840008250"
}

describe('IndividualItemInfoService', () => {
    let service: BackupItemExportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(BackupItemExportService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('should parse item info', () => {
        it('should parse items in permanent location correctly', () => {
            const parsed_data = service.extractItemDataFromAPIResponse("1245362362", test_item_in_main_location)
            expect(parsed_data).toBeTruthy();

            expect(parsed_data.library).toBe("SU-SU");
        })

        it('should parse items in temp location correctly', () => {
            const parsed_data = service.extractItemDataFromAPIResponse("1245362362", test_item_in_temp_location)
            expect(parsed_data).toBeTruthy();

            expect(parsed_data.inTempLocation).toBeTruthy()
            expect(parsed_data.library).toBe("SU-SU");
        })

        it('Should parse status correctly', () => {
            const parsed_data = service.extractItemDataFromAPIResponse("1245362362", test_item_in_temp_location)
            expect(parsed_data).toBeTruthy();

            expect(parsed_data.status).toBe("Item in place")
        })

        it('Should parse process type', () => {
            const parsed_data = service.extractItemDataFromAPIResponse("1245362362", test_item_in_temp_location)
            expect(parsed_data).toBeTruthy();

            expect(parsed_data.processType).toBe("Work Order")
        })
    })
});