import { TestBed } from '@angular/core/testing';

import { ReportService } from './report.service';
import {PhysicalItem} from "./parse-report.service";

let getPhysicalItem = (callNum: string): PhysicalItem => {

  return {
    barcode: "string",
    existsInAlma: true,

    mmsId: "",
    holdingId: "",
    pid: "",

    title: "",
    callNumber: callNum,
    library: "",
    location: "",
    itemMaterialType: "",
    policyType: "",
    status: "",
    processType: "",
    lastModifiedDate: 12,
    inTempLocation: false,
    requested: false
  }
}

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should sort call numbers correctly American Literature', () => {
    const a = getPhysicalItem("PS3572.A387Z6 2004")
    const b =  getPhysicalItem("PS3572.A39D66 2004")

    let result = service.sortLC(a, b)
    expect(result).toEqual(-1)
  })

  it('Should parse american liturature call numbers correctly', () => {
    const result = service.normalizeLC("PS3572.A39D66 2004")
    expect(result).toEqual("PS   03572.00000000000 A3900000 D6600000 2004", result)
  })

  it('should sort call numbers correctly literature', () => {
    const a = getPhysicalItem("PN3432.G6 1975")
    const b =  getPhysicalItem("PN3433.4.B73 2007")

    let result = service.sortLC(a, b)
    expect(result).toEqual(-1)
  })

  it('should sort call numbers correctly Architecture', () => {
    const a = getPhysicalItem("NA31.W45 1976")
    const b = getPhysicalItem("NA105.F87")

    let result = service.sortLC(a, b)
    expect(result).toEqual(-1)
  })

  it('should sort call numbers correctly musical', () => {
    const a = getPhysicalItem("M23.B4 op.7 2012")
    const b = getPhysicalItem("M23.B4 op.57 1981")

    let result = service.sortLC(a, b)
    expect(result).toEqual(-1)
  })

  it('should sort call numbers correctly Journal', () => {
    const a = getPhysicalItem("QA1.A647 v.3")
    const b = getPhysicalItem("QA1.A647 v.27")

    let result = service.sortLC(a, b)
    expect(result).toEqual(-1)
  })

  it('should sort call numbers correctly 5', () => {
    const a = getPhysicalItem("QA76.7.C36 2013")
    const b = getPhysicalItem("QA76.73.C153Y48 2005")

    let result = service.sortLC(a, b)
    expect(result).toEqual(-1)
  })
});
