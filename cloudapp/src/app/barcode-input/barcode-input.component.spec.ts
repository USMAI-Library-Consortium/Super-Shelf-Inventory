import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BarcodeInputComponent } from './barcode-input.component';

describe('BarcodeInputComponent', () => {
  let component: BarcodeInputComponent;
  let fixture: ComponentFixture<BarcodeInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BarcodeInputComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BarcodeInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // it('should create', () => {
  //   expect(component).toBeTruthy();
  // });
});
