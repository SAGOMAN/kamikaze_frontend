import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    @if (open()) {
      <div class="modal-backdrop" (click)="onBackdrop($event)" role="presentation">
        <div
          class="modal-dialog"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
        >
          <header class="modal-header">
            <h2>{{ title() }}</h2>
            <button type="button" class="modal-close" (click)="closed.emit()" aria-label="Cerrar">
              ×
            </button>
          </header>
          <div class="modal-body">
            <ng-content />
          </div>
          <footer class="modal-footer">
            <ng-content select="[modalFooter]" />
          </footer>
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly title = input('');
  readonly closed = output<void>();

  onBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
