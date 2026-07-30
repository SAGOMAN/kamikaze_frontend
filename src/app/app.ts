import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from './shared/confirm/confirm-dialog';
import { LoadingOverlay } from './shared/loading-overlay/loading-overlay';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingOverlay, ConfirmDialog],
  template: `
    <router-outlet />
    <app-confirm-dialog />
    <app-loading-overlay />
  `,
})
export class App {}