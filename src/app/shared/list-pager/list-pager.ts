import { Component, input, output } from '@angular/core';
import { PaginationMeta } from '../../core/models';

@Component({
  selector: 'app-list-pager',
  template: `
    @if (meta(); as m) {
      <div class="list-pager">
        <span class="list-pager-info">
          @if (m.total === 0) {
            Sin resultados
          } @else {
            {{ from(m) }}–{{ to(m) }} de {{ m.total }}
          }
        </span>
        <div class="list-pager-actions">
          <button
            type="button"
            class="btn ghost"
            [disabled]="m.current_page <= 1"
            (click)="pageChange.emit(m.current_page - 1)"
          >
            Anterior
          </button>
          <span class="list-pager-page">Pág. {{ m.current_page }} / {{ m.last_page || 1 }}</span>
          <button
            type="button"
            class="btn ghost"
            [disabled]="m.current_page >= m.last_page"
            (click)="pageChange.emit(m.current_page + 1)"
          >
            Siguiente
          </button>
        </div>
      </div>
    }
  `,
})
export class ListPager {
  readonly meta = input.required<PaginationMeta>();
  readonly pageChange = output<number>();

  from(m: PaginationMeta) {
    if (m.total === 0) return 0;
    return (m.current_page - 1) * m.per_page + 1;
  }

  to(m: PaginationMeta) {
    return Math.min(m.current_page * m.per_page, m.total);
  }
}
