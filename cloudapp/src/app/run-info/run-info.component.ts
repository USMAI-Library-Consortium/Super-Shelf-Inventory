import {Component, Input} from '@angular/core';
import {RunJobOutput} from '../alma-job.service';
import {PreviousRun} from '../state.service';

@Component({
    selector: 'app-run-info',
    templateUrl: './run-info.component.html',
    styleUrls: ['./run-info.component.scss']
})
export class RunInfoComponent {

    @Input() runInfo: RunJobOutput | PreviousRun
    @Input() prefix: string = null
    @Input() minimized: boolean = false

    constructor() {
    }

}
