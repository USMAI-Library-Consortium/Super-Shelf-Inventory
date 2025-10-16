import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormGroup} from "@angular/forms";
import {BehaviorSubject, combineLatest, of, Subject, Subscription} from "rxjs";
import {CloudAppConfigService, CloudAppEventsService} from "@exlibris/exl-cloudapp-angular-lib";
import {filter, map, switchMap} from "rxjs/operators";
import { FormGroupUtil } from "@exlibris/exl-cloudapp-angular-lib";
import {Router} from "@angular/router";

@Component({
    selector: 'app-administration',
    templateUrl: './administration.component.html',
    styleUrls: ['./administration.component.scss']
})
export class AdministrationComponent implements OnInit, OnDestroy {
    configurationForm!: FormGroup;

    // Whether a processing action (loading, saving) is happening
    loading$: BehaviorSubject<boolean> = new BehaviorSubject(true);
    private isAdmin$: Subject<boolean> = new Subject();
    canSave$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    // Whether the config has been pulled from the API, once this is done we can check
    // user permissions
    private formGroupIsReady$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    private saveConfigSubscription: Subscription | undefined;
    private loadConfigSubscription: Subscription | undefined;
    private isAdminSubscription: Subscription | undefined;
    private canSaveSubscription: Subscription | undefined; // We want to be able to click save only when there is no loading and when user is admin
    private disableFieldsSubscription: Subscription | undefined;

    constructor(private configService: CloudAppConfigService, public eventService: CloudAppEventsService, private router: Router) {
    }

    ngOnInit(): void {
        // Load the FormGroup which contains which postprocess settings the administrator has set.
        this.loadConfigSubscription = combineLatest([this.configService.getAsFormGroup(), this.isAdmin$]).pipe(map(data => {
            return {
                formGroup: data[0],
                isAdmin: data[1]
            }
        }), switchMap(data => {
            const configurationDefaultsSet = Object.keys(data.formGroup.value).length != 0
            if (configurationDefaultsSet) {
                // If there is a FormGroup already saved in ConfigService, load this.
                return of(data.formGroup)
            } else {
                if (data.isAdmin) {
                    // If there is NOT a FormGroup already saved in ConfigService, and the user is an Admin,
                    // save a default
                    return this.configService.set({
                        "inventoryField": "None",
                        "allowScanIn": false
                    }).pipe(switchMap(_ => {
                        return this.configService.getAsFormGroup()
                    }))
                } else {
                    // If there is NOT a FormGroup already saved in ConfigService and the user is NOT an admin,
                    // they cannot save the default. So, return a default.
                    return of(FormGroupUtil.toFormGroup({
                        "inventoryField": "None",
                        "allowScanIn": false
                    }))
                }
            }
        })).subscribe(formGroup => {
            this.configurationForm = formGroup;
            this.formGroupIsReady$.next(true);
        })

        // Load whether a user is an administrator
        this.isAdminSubscription = this.eventService.getInitData().pipe(map(data => {
            return data.user.isAdmin
        })).subscribe(isAdmin => {
            this.isAdmin$.next(isAdmin);
        })

        // Calculate whether a user can save data. This enables/disables the save button.
        // A user can save if they're an admin, and the component isn't loading something.
        this.canSaveSubscription = combineLatest([this.loading$, this.isAdmin$]).pipe(map(vals => {
            return {
                isLoading: vals[0],
                isAdmin: vals[1]
            }
        })).subscribe(state => {
            if (state.isAdmin && !state.isLoading) this.canSave$.next(true);
            else this.canSave$.next(false);
        })



        this.disableFieldsSubscription = combineLatest([this.formGroupIsReady$, this.isAdmin$]).pipe(map(data => {
            return {
                ready: data[0],
                isAdmin: data[1]
            }
        }), filter(data => data.ready)).subscribe(data => {
            if (!data.isAdmin) {
                this.configurationForm.get("inventoryField")!.disable()
                this.configurationForm.get("allowScanIn")!.disable()
            }
            this.loading$.next(false)
        })
    }

    ngOnDestroy() {
        if (this.saveConfigSubscription) this.saveConfigSubscription.unsubscribe();
        this.loadConfigSubscription?.unsubscribe();
        this.isAdminSubscription?.unsubscribe();
        this.canSaveSubscription?.unsubscribe();
        this.disableFieldsSubscription?.unsubscribe();
    }

    onBack() {
        this.router.navigate(['/'])
    }

    onSubmit() {
        this.loading$.next(true);
        this.saveConfigSubscription = this.configService.set(this.configurationForm.value).subscribe(result => {
            this.loading$.next(false);
        })
    }
}
