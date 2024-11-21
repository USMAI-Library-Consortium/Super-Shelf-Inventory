import {Component, OnInit} from '@angular/core';
import {FormGroup} from "@angular/forms";
import {BehaviorSubject} from "rxjs";
import {CloudAppConfigService} from "@exlibris/exl-cloudapp-angular-lib";

@Component({
    selector: 'app-administration',
    templateUrl: './administration.component.html',
    styleUrls: ['./administration.component.scss']
})
export class AdministrationComponent implements OnInit {
    configurationForm: FormGroup;
    loading$: BehaviorSubject<boolean> = new BehaviorSubject(true);

    constructor(private configService: CloudAppConfigService) {
    }

    ngOnInit(): void {
        this.configService.getAsFormGroup().subscribe(config => {
            if (Object.keys(config.value).length != 0) {
                console.log("Found configuration.")
                this.configurationForm = config;
                this.loading$.next(false);
            } else {
                this.configService.set({
                    "inventoryField": "None",
                    "allowScanIn": false
                }).subscribe(() => {
                    this.configService.getAsFormGroup().subscribe(config => {
                        this.configurationForm = config;
                        this.loading$.next(false);
                    })
                })
            }
        })
    }

    onSubmit() {
        this.loading$.next(true);
        this.configService.set(this.configurationForm.value).subscribe(result => {
            this.loading$.next(false);
        })
    }
}
