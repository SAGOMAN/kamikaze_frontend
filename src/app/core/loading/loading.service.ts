import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);

  readonly active = computed(() => this.pending() > 0);

  show() {
    this.pending.update((n) => n + 1);
  }

  hide() {
    this.pending.update((n) => Math.max(0, n - 1));
  }
}
