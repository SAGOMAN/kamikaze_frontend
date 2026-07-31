import { Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (confirm.request(); as req) {
      <div class="modal-backdrop" role="presentation">
        <div class="modal-dialog modal-dialog-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <header class="modal-header">
            <h2 id="confirm-title">Confirmar eliminación</h2>
          </header>
          <div class="modal-body">
            <p class="confirm-message">{{ req.message }}</p>
          </div>
          <footer class="modal-footer">
            <div class="actions modal-actions">
              <button type="button" class="btn ghost" (click)="confirm.respond(false)">Cancelar</button>
              <button type="button" class="btn danger" (click)="confirm.respond(true)">Eliminar</button>
            </div>
          </footer>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  readonly confirm = inject(ConfirmService);
}
