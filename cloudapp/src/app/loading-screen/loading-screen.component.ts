import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlmaJobService } from '../alma-job.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import {filter} from "rxjs/operators";

@Component({
  selector: 'app-loading-screen',
  templateUrl: './loading-screen.component.html',
  styleUrls: ['./loading-screen.component.scss']
})
export class LoadingScreenComponent implements OnInit, OnDestroy{

  private userMessagesSubscription: Subscription
  private loadCompleteSubscription: Subscription

  userMessages: string[] = []

  constructor(private ajs: AlmaJobService, private router: Router) { }

  ngOnInit(): void {
    this.userMessagesSubscription = this.ajs.userMessages$.subscribe(message => {
      this.userMessages.push(message)
    })

    this.loadCompleteSubscription = this.ajs.loadComplete$.pipe(filter(runJobOutput => {
      return runJobOutput !== null
    })).subscribe((output) => {
      console.log("Loading data complete.")
      this.router.navigate(["job-results-input"]);
    });
  }

  ngOnDestroy(): void {
    this.userMessagesSubscription.unsubscribe()
    this.loadCompleteSubscription.unsubscribe()
  }

}
