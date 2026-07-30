import { Injectable, signal } from '@angular/core';

interface ConfirmRequest {
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  ask(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.request.set({ message, resolve });
    });
  }

  respond(value: boolean) {
    const current = this.request();
    if (!current) return;
    current.resolve(value);
    this.request.set(null);
  }
}
