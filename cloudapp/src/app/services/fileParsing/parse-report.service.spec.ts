import {TestBed} from '@angular/core/testing';

import {ParseReportService} from './parse-report.service';

describe('ParseReportService', () => {
    let service: ParseReportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ParseReportService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('Should parse items with quotations correctly', () => {
        const csvFile = `MMS Record ID,HOL Record ID,Item PID, Barcode, Title, Publisher, Bib Material Type, Creator, Call Number, Permanent Call Number, Permanent Physical Location, Local Location, Holding Type, Item Material Type, Policy, Seq. Number,Chronology,Enumeration,Issue year,Description,Public note,Fulfillment note,Inventory  #,Inventory date,Shelf report #,On shelf date,On shelf seq,Last shelf report,Temp library,Temp location,Temp call # type,Temp call #,Temp item policy,Alt. call # type,Alt. call #,Pieces,Pages,Internal note (1),Internal note (2),Internal note (3),Statistics note (1),Statistics note (2),Statistics note (3),Creation date,Modification date,Status,Process type,Process Id,Number of loans,Last loan,Number of loans in house,Last loan in house,Year-to-date Loans,Receiving date,Copy ID, Receiving number, Weeding number, Weeding date, Other System Number, Committed to Retain, Retention Reason, Retention Note
"'378238691827683867'",'2839620391829681','3928169283945831','12958692309128',"Plato's \\"Republic\\"","Teaching Co.,",Music,"Roochnik, David.",184 P718r Yr,184 P718r Yr,ACSTACKS,AC,x,BOOK,EMPTY,,,,,guidebk,,,,,,,,,,,,,,1,,,,,,,,,,2010-08-10 05:59:00,2019-02-27 17:39:50,Item in place,,,0,,0,,0,Thu Jun 11 16:39:50 UTC 2015,,,,,,,,
"'378238691827683867'",'2839620391829681','3928169283945831','68291827682983',"Plato's \\"Republic\\"","Teaching Co.,",Music,"Roochnik, David.",184 P718r Yr,184 P718r Yr,ACSTACKS,AC,x,DVD,EMPTY,,,2,,pt.2,,Contains 6 discs,,,,,,,,,,,,1,,,,,,,,,,2010-08-10 05:59:00,2023-08-03 16:25:33,Item in place,,,0,,0,,0,Thu Jun 11 16:25:31 UTC 2015,,,,,,,,
"'378238691827683867'",'2839620391829681','3928169283945831','23869128619286',"Plato's \\"Republic\\"","Teaching Co.,",Music,"Roochnik, David.",184 P718r Yr,184 P718r Yr,ACSTACKS,AC,x,DVD,EMPTY,,,1,,pt.1,,Contains 6 discs,,,,,,,,,,,,,,,,,,,,,,2010-08-10 05:59:00,2023-08-03 16:25:24,Item in place,,,3,Wed Oct 07 10:59:00 UTC 2015,0,,0,Thu Jun 11 16:25:22 UTC 2015,,,,,,,,
`
        service.parseReport(csvFile, ['12958692309128', '68291827682983', '23869128619286']).subscribe(items => {
            expect(items.length).toEqual(3);
            expect(items[0].library).toEqual("AC");
            expect(items[0].status).toEqual("Item in place");
            expect(items[1].library).toEqual("AC");
            expect(items[1].status).toEqual("Item in place");
            expect(items[2].library).toEqual("AC");
            expect(items[2].status).toEqual("Item in place");
        })
    })

    it("Should parse standard items correctly", () => {
        const csvFile = `MMS Record ID,HOL Record ID,Item PID, Barcode, Title, Publisher, Bib Material Type, Creator, Call Number, Permanent Call Number, Permanent Physical Location, Local Location, Holding Type, Item Material Type, Policy, Seq. Number,Chronology,Enumeration,Issue year,Description,Public note,Fulfillment note,Inventory  #,Inventory date,Shelf report #,On shelf date,On shelf seq,Last shelf report,Temp library,Temp location,Temp call # type,Temp call #,Temp item policy,Alt. call # type,Alt. call #,Pieces,Pages,Internal note (1),Internal note (2),Internal note (3),Statistics note (1),Statistics note (2),Statistics note (3),Creation date,Modification date,Status,Process type,Process Id,Number of loans,Last loan,Number of loans in house,Last loan in house,Year-to-date Loans,Receiving date,Copy ID, Receiving number, Weeding number, Weeding date, Other System Number, Committed to Retain, Retention Reason, Retention Note
"'239868102986129869'",'23960129604970394','12986819209683420','31430025458854',"Music and the pursuit of happiness in the eighteenth century : May 16-June 26, 1983, University Gallery, University of Minnesota.","The University Gallery,",Book,"Wehking, Carolyn M.",ML85 .W4 1983,ML85 .W4 1983,FOLIO,CPART,x,BOOK,01,000010,,,,,,,,,,,,,,,,,,,,,,Last Inventoried on 2024-11-05,,,,,,1999-05-19 06:59:00,,Item in place,,,3,Wed Aug 31 10:59:00 UTC 2005,0,,0,Wed May 19 10:59:00 UTC 1999,,,,,,,,
"'239868102986129869'",'23960129604970394','12986819209683420','31430023340427',"Near Eastern, Mediterranean and European chronology. The historical, archaeological, radiocarbon, pollenanalytical and geochronological evidence,","P. Aström,",Book,"Thomas, Homer L.",GN775 .T487,GN775 .T487,FOLIO,CPART,v,BOOK,01,000020,,2,,v.2,,,,,,,,,,,,,,,,,,Last Inventoried on 2024-11-05,,,,,,2002-11-25 05:59:00,2021-07-30 06:59:00,Item in place,,,1,,0,,0,Mon Nov 25 10:59:00 UTC 2002,,,,,,,,`

        service.parseReport(csvFile, ['31430025458854', '31430023340427']).subscribe(items => {
            expect(items.length).toEqual(2);
            expect(items[0].library).toEqual("CPART");
            expect(items[0].status).toEqual("Item in place");
            expect(items[1].library).toEqual("CPART");
            expect(items[1].status).toEqual("Item in place");
        })
    })
});
