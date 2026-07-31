import { signal } from '@angular/core';
import { PaginatedResponse, PaginationMeta } from './models';

/** Estado reutilizable de búsqueda + paginación para listados. */
export class ListQueryState {
  search = '';
  page = 1;
  readonly perPage = 15;
  readonly meta = signal<PaginationMeta>({
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  });

  params(extra: Record<string, string | number | boolean | null | undefined> = {}) {
    return {
      search: this.search.trim() || undefined,
      page: this.page,
      per_page: this.perPage,
      ...extra,
    };
  }

  apply<T>(response: PaginatedResponse<T>, setItems: (items: T[]) => void) {
    setItems(response.data);
    this.meta.set(response.meta);
  }

  runSearch(reload: () => void) {
    this.page = 1;
    reload();
  }

  goToPage(page: number, reload: () => void) {
    if (page < 1 || page > this.meta().last_page) return;
    this.page = page;
    reload();
  }
}
