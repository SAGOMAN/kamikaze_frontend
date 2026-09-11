import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Branch, PaginatedResponse, Product, Sale } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { localDateIso } from '../../shared/date/local-iso-date';
import { TimestampPipe } from '../../shared/date/timestamp.pipe';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

interface DraftItem {
  product_id: number;
  quantity: number;
}

@Component({
  selector: 'app-sales',
  imports: [FormsModule, Modal, TimestampPipe, ListPager, FieldError],
  templateUrl: './sales.html',
  styleUrl: './sales.css',
})
export class SalesPage implements OnInit {
  readonly sales = signal<Sale[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly products = signal<Product[]>([]);
  readonly formOpen = signal(false);
  readonly selectedBranchId = signal<number | null>(null);
  readonly catalogQuery = signal('');
  readonly list = new ListQueryState();
  listBranchId: number | null = null;
  saleDate = localDateIso();
  notes = '';
  items: DraftItem[] = [];
  formError = '';
  apiErrors: Record<string, string> = {};
  readonly showInvalid = showInvalid;

  readonly selectedBranch = computed(
    () => this.branches().find((b) => b.id === this.selectedBranchId()) ?? null,
  );

  /** Productos asignados a la sucursal del formulario (con registro de stock). */
  readonly availableProducts = computed(() => {
    const branchId = this.selectedBranchId();
    if (branchId == null) {
      return [];
    }
    return this.products().filter((product) =>
      product.stocks?.some((stock) => stock.branch_id === branchId),
    );
  });

  readonly catalogProducts = computed(() => {
    const query = this.catalogQuery().trim().toLowerCase();
    const list = this.availableProducts();
    if (!query) {
      return list;
    }
    return list.filter((product) => {
      const name = product.name.toLowerCase();
      const sku = (product.sku || '').toLowerCase();
      return name.includes(query) || sku.includes(query);
    });
  });

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => {
      const active = data.filter((b) => b.is_active);
      this.branches.set(active.length ? active : data);
      this.selectedBranchId.set(this.branches()[0]?.id ?? null);
    });
    this.reloadProducts();
    this.reload();
  }

  reloadProducts() {
    this.api.get<Product[]>('/products', { is_active: true }).subscribe((data) => this.products.set(data));
  }

  reload() {
    this.api
      .get<PaginatedResponse<Sale>>('/sales', this.list.params({ branch_id: this.listBranchId }))
      .subscribe((res) => this.list.apply(res, (data) => this.sales.set(data)));
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
  }

  onListBranchChange() {
    this.searchNow();
  }

  goToPage(page: number) {
    this.list.goToPage(page, () => this.reload());
  }

  openCreate() {
    this.resetForm();
    this.formOpen.set(true);
  }

  closeForm() {
    this.resetForm();
    this.formOpen.set(false);
  }

  resetForm() {
    this.formError = '';
    this.apiErrors = {};
    this.saleDate = localDateIso();
    this.notes = '';
    this.items = [];
    this.catalogQuery.set('');
    this.selectedBranchId.set(this.branches()[0]?.id ?? null);
  }

  onFormBranchChange(branchId: number | null) {
    this.selectedBranchId.set(branchId);
    this.items = [];
    this.catalogQuery.set('');
    this.formError = '';
  }

  stockFor(product: Product | undefined | null): number {
    const branchId = this.selectedBranchId();
    if (!product || branchId == null) {
      return 0;
    }
    return product.stocks?.find((s) => s.branch_id === branchId)?.quantity ?? 0;
  }

  productById(id: number | null | undefined): Product | undefined {
    if (id == null) {
      return undefined;
    }
    return this.products().find((p) => p.id === id);
  }

  qtyInCart(productId: number, exceptIndex = -1): number {
    return this.items.reduce((sum, item, index) => {
      if (index === exceptIndex || item.product_id !== productId) {
        return sum;
      }
      return sum + (item.quantity || 0);
    }, 0);
  }

  remainingStock(product: Product, exceptIndex = -1): number {
    return Math.max(0, this.stockFor(product) - this.qtyInCart(product.id, exceptIndex));
  }

  maxQty(index: number): number {
    const item = this.items[index];
    const product = this.productById(item?.product_id);
    if (!product) {
      return 0;
    }
    return this.remainingStock(product, index);
  }

  canAdd(product: Product | undefined | null): boolean {
    if (!product) {
      return false;
    }
    return this.remainingStock(product) > 0;
  }

  addProduct(product: Product) {
    if (!this.availableProducts().some((item) => item.id === product.id) || !this.canAdd(product)) {
      return;
    }
    const existing = this.items.find((item) => item.product_id === product.id);
    if (existing) {
      existing.quantity += 1;
      this.items = [...this.items];
      return;
    }
    this.items = [...this.items, { product_id: product.id, quantity: 1 }];
  }

  stepQty(index: number, delta: number) {
    const current = this.items[index];
    if (!current) {
      return;
    }
    const next = current.quantity + delta;
    if (next < 1) {
      this.removeItem(index);
      return;
    }
    this.setQty(index, next);
  }

  setQty(index: number, quantity: number) {
    const max = this.maxQty(index);
    const parsed = Number(quantity);
    const safe = Number.isFinite(parsed) ? Math.floor(parsed) : 1;
    const next = Math.max(1, max > 0 ? Math.min(safe, max) : 1);
    this.items[index] = { ...this.items[index], quantity: next };
    this.items = [...this.items];
  }

  removeItem(index: number) {
    this.items = this.items.filter((_, i) => i !== index);
  }

  unitPrice(product: Product | undefined | null): number {
    return Number(product?.unit_price ?? 0);
  }

  lineSubtotal(item: DraftItem): number {
    return this.unitPrice(this.productById(item.product_id)) * (item.quantity || 0);
  }

  draftTotal(): number {
    return this.items.reduce((sum, item) => sum + this.lineSubtotal(item), 0);
  }

  qtyExceedsStock(index: number): boolean {
    const item = this.items[index];
    if (!item) {
      return false;
    }
    return (item.quantity || 0) > this.maxQty(index);
  }

  formatMoney(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value ?? 0));
  }

  itemsSummary(sale: Sale): string {
    const items = sale.items ?? [];
    if (!items.length) {
      return 'Sin ítems';
    }
    return items
      .map((item) => {
        const name = item.product?.name || `Producto ${item.product_id}`;
        return `${name} × ${item.quantity}`;
      })
      .join(', ');
  }

  save(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
    if (!this.items.length) {
      this.formError = 'Agrega al menos un producto de esta sucursal.';
      return;
    }
    if (this.items.some((_, index) => this.qtyExceedsStock(index))) {
      this.formError = 'Hay cantidades que superan el stock de la sucursal.';
      return;
    }
    this.api
      .post('/sales', {
        branch_id: this.selectedBranchId(),
        sale_date: this.saleDate,
        notes: this.notes,
        items: this.items,
      })
      .subscribe({
        next: () => {
          this.closeForm();
          this.reload();
          this.reloadProducts();
        },
        error: (err) => {
          const parsed = parseApiError(err, 'Error al registrar venta');
          this.formError = parsed.message;
          this.apiErrors = parsed.fieldErrors;
        },
      });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask(
      '¿Está seguro de que desea eliminar esta venta? Se devolverá el stock correspondiente.',
    );
    if (!ok) return;
    this.api.delete(`/sales/${id}`).subscribe(() => {
      this.reload();
      this.reloadProducts();
    });
  }
}
