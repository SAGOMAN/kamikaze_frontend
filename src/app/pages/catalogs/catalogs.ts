import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Catalog, CatalogItem, PaginatedResponse } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-catalogs',
  imports: [FormsModule, Modal, ListPager, FieldError],
  templateUrl: './catalogs.html',
  styleUrl: './catalogs.css',
})
export class CatalogsPage implements OnInit {
  readonly catalogs = signal<Catalog[]>([]);
  readonly items = signal<CatalogItem[]>([]);
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

  readonly selectedCatalog = computed(
    () => this.catalogs().find((c) => c.id === this.selectedId()) ?? null,
  );

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.get<PaginatedResponse<Catalog>>('/catalogs', this.list.params()).subscribe((res) => {
      this.list.apply(res, (data) => this.catalogs.set(data));
      const selected = this.selectedId();
      const still = this.catalogs().some((c) => c.id === selected);
      if (!still) {
        this.selectedId.set(this.catalogs()[0]?.id ?? null);
      }
      this.syncItems();
    });
  }

  syncItems() {
    const current = this.selectedCatalog();
    this.items.set(current?.items ?? []);
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
  }

  goToPage(page: number) {
    this.list.goToPage(page, () => this.reload());
  }

  selectCatalog(item: Catalog) {
    this.selectedId.set(item.id);
    this.syncItems();
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
      next: (saved) => {
        this.closeCatalogForm();
        this.selectedId.set(saved.id);
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
      next: () => {
        if (this.selectedId() === item.id) {
          this.selectedId.set(null);
        }
        this.reload();
      },
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
    if (f.invalid || !this.selectedId()) {
      return;
    }
    const req = this.editingItemId
      ? this.api.put(`/catalog-items/${this.editingItemId}`, this.itemForm)
      : this.api.post(`/catalogs/${this.selectedId()}/items`, this.itemForm);
    req.subscribe({
      next: () => {
        this.closeItemForm();
        this.reload();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el valor');
        this.itemError = parsed.message;
        this.itemApiErrors = parsed.fieldErrors;
      },
    });
  }

  async removeItem(item: CatalogItem) {
    const ok = await this.confirm.ask(`¿Está seguro de que desea eliminar “${item.name}”?`);
    if (!ok) return;
    this.api.delete(`/catalog-items/${item.id}`).subscribe(() => this.reload());
  }
}
