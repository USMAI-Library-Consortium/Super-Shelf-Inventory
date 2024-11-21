import {Component, Input} from '@angular/core';
import {PreviousRun} from '../services/apis/state.service';
import {AlmaJob} from "../services/apis/export-job.service";

@Component({
    selector: 'app-run-info',
    templateUrl: './run-info.component.html',
    styleUrls: ['./run-info.component.scss']
})
export class RunInfoComponent {

    @Input() runInfo: AlmaJob | PreviousRun
    @Input() prefix: string = null
    @Input() minimized: boolean = false

    constructor() {
    }

}
