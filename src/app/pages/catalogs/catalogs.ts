import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Catalog, CatalogItem, PaginatedResponse } from '../../core/models';
import { ActionBtn } from '../../shared/action-btn/action-btn';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-catalogs',
  imports: [FormsModule, Modal, ListPager, FieldError, ActionBtn],
  templateUrl: './catalogs.html',
  styleUrl: './catalogs.css',
})
export class CatalogsPage implements OnInit {
  readonly catalogs = signal<Catalog[]>([]);
  readonly items = signal<CatalogItem[]>([]);
  readonly detailCatalog = signal<Catalog | null>(null);
  readonly selectedId = signal<number | null>(null);
  readonly catalogFormOpen = signal(false);
  readonly itemFormOpen = signal(false);
  readonly list = new ListQueryState();
  readonly showInvalid = showInvalid;

  catalogForm: Partial<Catalog> = { code: '', name: '', description: '', is_active: true };
  editingCatalogId: number | null = null;
  catalogError = '';
  catalogApiErrors: Record<string, string> = {};

  itemForm: Partial<CatalogItem> = { name: '', code: '', sort_order: 0, is_active: true };
  editingItemId: number | null = null;
  itemError = '';
  itemApiErrors: Record<string, string> = {};

  readonly isDetail = computed(() => this.selectedId() !== null);

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params.get('id');
      if (!raw) {
        this.selectedId.set(null);
        this.detailCatalog.set(null);
        this.items.set([]);
        this.catalogError = '';
        if (this.catalogs().length === 0) {
          this.reload();
        }
        return;
      }
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) {
        this.goBackToList();
        return;
      }
      this.selectedId.set(id);
      const fromList = this.catalogs().find((c) => c.id === id);
      if (fromList) {
        this.detailCatalog.set(fromList);
        this.items.set(fromList.items ?? []);
      }
      this.loadDetail(id);
    });
  }

  reload() {
    this.api.get<PaginatedResponse<Catalog>>('/catalogs', this.list.params()).subscribe((res) => {
      this.list.apply(res, (data) => this.catalogs.set(data));
    });
  }

  loadDetail(id: number) {
    this.catalogError = '';
    this.api.get<Catalog>(`/catalogs/${id}`).subscribe({
      next: (cat) => {
        this.detailCatalog.set(cat);
        this.items.set(cat.items ?? []);
      },
      error: (err) => {
        this.detailCatalog.set(null);
        this.items.set([]);
        const parsed = parseApiError(err, 'No se pudo cargar el catálogo');
        this.catalogError = parsed.message;
      },
    });
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
  }

  goToPage(page: number) {
    this.list.goToPage(page, () => this.reload());
  }

  viewRecords(item: Catalog) {
    this.router.navigate(['/app/catalogs', item.id]);
  }

  goBackToList() {
    this.router.navigate(['/app/catalogs']);
  }

  openCreateCatalog() {
    this.editingCatalogId = null;
    this.catalogError = '';
    this.catalogApiErrors = {};
    this.catalogForm = { code: '', name: '', description: '', is_active: true };
    this.catalogFormOpen.set(true);
  }

  editCatalog(item: Catalog) {
    this.editingCatalogId = item.id;
    this.catalogError = '';
    this.catalogApiErrors = {};
    this.catalogForm = { ...item };
    this.catalogFormOpen.set(true);
  }

  closeCatalogForm() {
    this.catalogFormOpen.set(false);
  }

  saveCatalog(f: NgForm) {
    this.catalogError = '';
    this.catalogApiErrors = {};
    if (f.invalid) {
      return;
    }
    const req = this.editingCatalogId
      ? this.api.put<Catalog>(`/catalogs/${this.editingCatalogId}`, this.catalogForm)
      : this.api.post<Catalog>('/catalogs', this.catalogForm);
    req.subscribe({
      next: () => {
        this.closeCatalogForm();
        this.reload();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el catálogo');
        this.catalogError = parsed.message;
        this.catalogApiErrors = parsed.fieldErrors;
      },
    });
  }

  async removeCatalog(item: Catalog) {
    const ok = await this.confirm.ask(`¿Está seguro de que desea eliminar “${item.name}”?`);
    if (!ok) return;
    this.api.delete(`/catalogs/${item.id}`).subscribe({
      next: () => this.reload(),
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo eliminar el catálogo');
        this.catalogError = parsed.message;
      },
    });
  }

  openCreateItem() {
    if (!this.selectedId()) {
      return;
    }
    this.editingItemId = null;
    this.itemError = '';
    this.itemApiErrors = {};
    this.itemForm = { name: '', code: '', sort_order: this.items().length + 1, is_active: true };
    this.itemFormOpen.set(true);
  }

  editItem(item: CatalogItem) {
    this.editingItemId = item.id;
    this.itemError = '';
    this.itemApiErrors = {};
    this.itemForm = { ...item };
    this.itemFormOpen.set(true);
  }

  closeItemForm() {
    this.itemFormOpen.set(false);
  }

  saveItem(f: NgForm) {
    this.itemError = '';
    this.itemApiErrors = {};
    const catalogId = this.selectedId();
    if (f.invalid || !catalogId) {
      return;
    }
    const req = this.editingItemId
      ? this.api.put(`/catalog-items/${this.editingItemId}`, this.itemForm)
      : this.api.post(`/catalogs/${catalogId}/items`, this.itemForm);
    req.subscribe({
      next: () => {
        this.closeItemForm();
        this.loadDetail(catalogId);
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el valor');
        this.itemError = parsed.message;
        this.itemApiErrors = parsed.fieldErrors;
      },
    });
  }

  async removeItem(item: CatalogItem) {
    const catalogId = this.selectedId();
    const ok = await this.confirm.ask(`¿Está seguro de que desea eliminar “${item.name}”?`);
    if (!ok) return;
    this.api.delete(`/catalog-items/${item.id}`).subscribe(() => {
      if (catalogId) {
        this.loadDetail(catalogId);
      }
    });
  }
}
