import { Component, inject } from '@angular/core';
import { LoadingService } from '../../core/loading/loading.service';

@Component({
  selector: 'app-loading-overlay',
  template: `
    @if (loading.active()) {
      <div class="loading-overlay" role="status" aria-live="polite" aria-busy="true">
        <div class="loading-card">
          <div class="spinner lg" aria-hidden="true"></div>
          <span>Procesando…</span>
        </div>
      </div>
    }
  `,
})
export class LoadingOverlay {
  readonly loading = inject(LoadingService);
}
