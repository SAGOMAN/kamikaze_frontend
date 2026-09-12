import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Branch, Catalog, CatalogItem, Expense, PaginatedResponse, Product, ProductStock } from '../../core/models';
import { ActionBtn } from '../../shared/action-btn/action-btn';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { CivilDatePipe } from '../../shared/date/civil-date.pipe';
import { localDateIso } from '../../shared/date/local-iso-date';
import { TimestampPipe } from '../../shared/date/timestamp.pipe';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

export type InventoryTab = 'catalog' | 'purchases' | 'operational';

export interface BranchStockCard {
  branch: Branch;
  stocks: ProductStock[];
}

@Component({
  selector: 'app-inventory',
  imports: [FormsModule, Modal, TimestampPipe, CivilDatePipe, ListPager, FieldError, ActionBtn],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css',
})
export class InventoryPage implements OnInit {
  readonly tab = signal<InventoryTab>('catalog');
  readonly products = signal<Product[]>([]);
  readonly catalog = signal<Product[]>([]);
  readonly stocks = signal<ProductStock[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly purchases = signal<Expense[]>([]);
  readonly operational = signal<Expense[]>([]);
  readonly expenseCategories = signal<CatalogItem[]>([]);
  readonly purchasesLoaded = signal(false);
  readonly formOpen = signal(false);
  readonly stockOpen = signal(false);
  readonly purchaseOpen = signal(false);
  readonly operationalOpen = signal(false);
  readonly stockSearch = signal('');
  readonly productList = new ListQueryState();
  readonly purchaseList = new ListQueryState();
  readonly operationalList = new ListQueryState();
  readonly showInvalid = showInvalid;

  form: Partial<Product> = { name: '', sku: '', unit_price: 0, is_active: true };
  editingId: number | null = null;
  includeFirstPurchase = false;
  firstPurchase = {
    branch_id: null as number | null,
    quantity: 1,
    unit_cost: 0,
    purchase_date: localDateIso(),
  };
  formError = '';
  apiErrors: Record<string, string> = {};

  stockForm = { product_id: null as number | null, branch_id: null as number | null, quantity: 0 };
  stockFormError = '';
  stockApiErrors: Record<string, string> = {};

  purchaseForm = {
    product_id: null as number | null,
    branch_id: null as number | null,
    quantity: 1,
    unit_cost: 0,
    purchase_date: localDateIso(),
    notes: '',
  };
  purchaseError = '';
  purchaseApiErrors: Record<string, string> = {};
  editingPurchaseId: number | null = null;
  purchaseEditForm = { expense_date: localDateIso(), notes: '' };

  operationalForm: Partial<Expense> = {
    category: '',
    description: '',
    amount: 0,
    expense_date: localDateIso(),
    branch_id: null,
    notes: '',
  };
  editingOperationalId: number | null = null;
  operationalError = '';
  operationalApiErrors: Record<string, string> = {};
  listError = '';

  readonly branchStockCards = computed<BranchStockCard[]>(() => {
    const term = this.stockSearch().trim().toLowerCase();
    const stocks = this.stocks();
    const cards = this.branches().map((branch) => {
      let branchStocks = stocks.filter((s) => s.branch_id === branch.id);
      if (term) {
        branchStocks = branchStocks.filter((s) => {
          const name = (s.product?.name || '').toLowerCase();
          const sku = (s.product?.sku || '').toLowerCase();
          return name.includes(term) || sku.includes(term);
        });
      }
      return { branch, stocks: branchStocks };
    });
    if (!term) return cards;
    return cards.filter((card) => card.stocks.length > 0);
  });

  readonly hasLegacyStock = computed(() => {
    const hasStock = this.stocks().some((s) => (s.quantity || 0) > 0);
    return this.purchasesLoaded() && hasStock && this.purchaseList.meta().total === 0;
  });

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'catalog' || tab === 'purchases' || tab === 'operational') {
        this.tab.set(tab);
      }
    });
    this.api.get<Branch[]>('/branches').subscribe((data) => this.branches.set(data));
    this.loadExpenseCategories();
    this.reloadCatalog();
    this.reloadProducts();
    this.reloadStocks();
    this.reloadPurchases();
    this.reloadOperational();
  }

  setTab(tab: InventoryTab) {
    this.tab.set(tab);
    this.listError = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  loadExpenseCategories() {
    this.api.get<Catalog[]>('/catalogs', { code: 'expense_categories' }).subscribe((data) => {
      const items = data[0]?.items ?? [];
      this.expenseCategories.set(items.filter((item) => item.is_active));
    });
  }

  expenseCategoryOptions(): CatalogItem[] {
    const items = this.expenseCategories();
    const current = this.operationalForm.category;
    if (current && !items.some((item) => item.name === current)) {
      return [
        {
          id: 0,
          catalog_id: 0,
          name: current,
          is_active: true,
          sort_order: 0,
        },
        ...items,
      ];
    }
    return items;
  }

  reloadCatalog() {
    this.api.get<Product[]>('/products').subscribe((data) => this.catalog.set(data));
  }

  reloadProducts() {
    this.api
      .get<PaginatedResponse<Product>>('/products', this.productList.params())
      .subscribe((res) => this.productList.apply(res, (data) => this.products.set(data)));
  }

  reloadStocks() {
    this.api.get<ProductStock[]>('/product-stocks').subscribe((data) => this.stocks.set(data));
  }

  reloadPurchases() {
    this.api
      .get<PaginatedResponse<Expense>>('/expenses', this.purchaseList.params({ source: 'merchandise' }))
      .subscribe((res) => {
        this.purchaseList.apply(res, (data) => this.purchases.set(data));
        this.purchasesLoaded.set(true);
      });
  }

  reloadOperational() {
    this.api
      .get<PaginatedResponse<Expense>>(
        '/expenses',
        this.operationalList.params({ source: 'operational' }),
      )
      .subscribe((res) => this.operationalList.apply(res, (data) => this.operational.set(data)));
  }

  searchProducts() {
    this.productList.runSearch(() => this.reloadProducts());
  }

  goToProductPage(page: number) {
    this.productList.goToPage(page, () => this.reloadProducts());
  }

  searchPurchases() {
    this.purchaseList.runSearch(() => this.reloadPurchases());
  }

  goToPurchasePage(page: number) {
    this.purchaseList.goToPage(page, () => this.reloadPurchases());
  }

  searchOperational() {
    this.operationalList.runSearch(() => this.reloadOperational());
  }

  goToOperationalPage(page: number) {
    this.operationalList.goToPage(page, () => this.reloadOperational());
  }

  formatMoney(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
      Number(value ?? 0),
    );
  }

  purchaseAmount(): number {
    return (Number(this.purchaseForm.quantity) || 0) * (Number(this.purchaseForm.unit_cost) || 0);
  }

  openCreateProduct() {
    this.resetProduct();
    this.formOpen.set(true);
  }

  editProduct(item: Product) {
    this.editingId = item.id;
    this.formError = '';
    this.apiErrors = {};
    this.includeFirstPurchase = false;
    this.form = { ...item };
    this.formOpen.set(true);
  }

  closeProductForm() {
    this.resetProduct();
    this.formOpen.set(false);
  }

  resetProduct() {
    this.editingId = null;
    this.formError = '';
    this.apiErrors = {};
    this.includeFirstPurchase = false;
    this.form = { name: '', sku: '', unit_price: 0, is_active: true };
    this.firstPurchase = {
      branch_id: this.branches()[0]?.id ?? null,
      quantity: 1,
      unit_cost: 0,
      purchase_date: localDateIso(),
    };
  }

  saveProduct(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
    if (!this.editingId && this.includeFirstPurchase) {
      if (!this.firstPurchase.branch_id || this.firstPurchase.quantity < 1) {
        this.formError = 'Completa sucursal y cantidad de la primera compra.';
        return;
      }
    }
    const req = this.editingId
      ? this.api.put<Product>(`/products/${this.editingId}`, this.form)
      : this.api.post<Product>('/products', this.form);
    req.subscribe({
      next: (product) => {
        const created = !this.editingId;
        const shouldPurchase = created && this.includeFirstPurchase && product?.id;
        if (shouldPurchase) {
          this.api
            .post('/purchases', {
              product_id: product.id,
              branch_id: this.firstPurchase.branch_id,
              quantity: this.firstPurchase.quantity,
              unit_cost: this.firstPurchase.unit_cost,
              purchase_date: this.firstPurchase.purchase_date,
            })
            .subscribe({
              next: () => {
                this.closeProductForm();
                this.afterCatalogChange();
                this.reloadPurchases();
              },
              error: (err) => {
                const parsed = parseApiError(err, 'El producto se creó, pero no se pudo registrar la compra');
                this.formError = parsed.message;
                this.apiErrors = parsed.fieldErrors;
                this.afterCatalogChange();
              },
            });
          return;
        }
        this.closeProductForm();
        this.afterCatalogChange();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el producto');
        this.formError = parsed.message;
        this.apiErrors = parsed.fieldErrors;
      },
    });
  }

  async removeProduct(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este producto?');
    if (!ok) return;
    this.api.delete(`/products/${id}`).subscribe(() => this.afterCatalogChange());
  }

  afterCatalogChange() {
    this.reloadCatalog();
    this.reloadProducts();
    this.reloadStocks();
  }

  openBuy(branchId?: number, productId?: number) {
    this.editingPurchaseId = null;
    this.purchaseError = '';
    this.purchaseApiErrors = {};
    const product = this.catalog().find((p) => p.id === (productId ?? null));
    this.purchaseForm = {
      product_id: productId ?? null,
      branch_id: branchId ?? this.branches()[0]?.id ?? null,
      quantity: 1,
      unit_cost: Number(product?.last_cost ?? 0),
      purchase_date: localDateIso(),
      notes: '',
    };
    this.purchaseOpen.set(true);
  }

  onPurchaseProductChange() {
    const product = this.catalog().find((p) => p.id === this.purchaseForm.product_id);
    if (product?.last_cost != null && product.last_cost !== '') {
      this.purchaseForm.unit_cost = Number(product.last_cost);
    }
  }

  stepPurchaseQty(delta: number) {
    const next = Math.max(1, (Number(this.purchaseForm.quantity) || 1) + delta);
    this.purchaseForm.quantity = next;
  }

  closePurchase() {
    this.editingPurchaseId = null;
    this.purchaseError = '';
    this.purchaseApiErrors = {};
    this.purchaseOpen.set(false);
  }

  savePurchase(f: NgForm) {
    this.purchaseError = '';
    this.purchaseApiErrors = {};
    if (f.invalid) {
      return;
    }
    if (this.editingPurchaseId) {
      this.api
        .put(`/expenses/${this.editingPurchaseId}`, {
          expense_date: this.purchaseEditForm.expense_date,
          notes: this.purchaseEditForm.notes,
        })
        .subscribe({
          next: () => {
            this.closePurchase();
            this.reloadPurchases();
          },
          error: (err) => {
            const parsed = parseApiError(err, 'No se pudo guardar la compra');
            this.purchaseError = parsed.message;
            this.purchaseApiErrors = parsed.fieldErrors;
          },
        });
      return;
    }
    this.api.post('/purchases', this.purchaseForm).subscribe({
      next: () => {
        this.closePurchase();
        this.reloadPurchases();
        this.afterCatalogChange();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo registrar la compra');
        this.purchaseError = parsed.message;
        this.purchaseApiErrors = parsed.fieldErrors;
      },
    });
  }

  editPurchase(item: Expense) {
    this.editingPurchaseId = item.id;
    this.purchaseError = '';
    this.purchaseApiErrors = {};
    this.purchaseEditForm = {
      expense_date: String(item.expense_date).slice(0, 10),
      notes: item.notes || '',
    };
    this.purchaseForm = {
      product_id: item.product_id ?? null,
      branch_id: item.branch_id ?? null,
      quantity: item.quantity ?? 1,
      unit_cost: Number(item.unit_cost ?? 0),
      purchase_date: String(item.expense_date).slice(0, 10),
      notes: item.notes || '',
    };
    this.purchaseOpen.set(true);
  }

  async removePurchase(id: number) {
    const ok = await this.confirm.ask(
      '¿Anular esta compra? Se revertirá el stock si aún no se ha vendido.',
    );
    if (!ok) return;
    this.listError = '';
    this.api.delete(`/expenses/${id}`).subscribe({
      next: () => {
        this.reloadPurchases();
        this.reloadStocks();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo anular la compra');
        this.listError = parsed.message;
      },
    });
  }

  openAdjustStock(stock: ProductStock) {
    this.stockFormError = '';
    this.stockApiErrors = {};
    this.stockForm = {
      product_id: stock.product_id,
      branch_id: stock.branch_id,
      quantity: stock.quantity,
    };
    this.stockOpen.set(true);
  }

  closeStock() {
    this.stockFormError = '';
    this.stockApiErrors = {};
    this.stockForm = { product_id: null, branch_id: null, quantity: 0 };
    this.stockOpen.set(false);
  }

  saveStock(f: NgForm) {
    this.stockFormError = '';
    this.stockApiErrors = {};
    if (f.invalid) {
      return;
    }
    this.api.put('/product-stocks', this.stockForm).subscribe({
      next: () => {
        this.closeStock();
        this.reloadStocks();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo ajustar el stock');
        this.stockFormError = parsed.message;
        this.stockApiErrors = parsed.fieldErrors;
      },
    });
  }

  openCreateOperational() {
    this.resetOperational();
    this.operationalOpen.set(true);
  }

  editOperational(item: Expense) {
    this.editingOperationalId = item.id;
    this.operationalError = '';
    this.operationalApiErrors = {};
    this.operationalForm = {
      ...item,
      expense_date: String(item.expense_date).slice(0, 10),
    };
    this.operationalOpen.set(true);
  }

  closeOperational() {
    this.resetOperational();
    this.operationalOpen.set(false);
  }

  resetOperational() {
    this.editingOperationalId = null;
    this.operationalError = '';
    this.operationalApiErrors = {};
    this.operationalForm = {
      category: '',
      description: '',
      amount: 0,
      expense_date: localDateIso(),
      branch_id: null,
      notes: '',
    };
  }

  saveOperational(f: NgForm) {
    this.operationalError = '';
    this.operationalApiErrors = {};
    if (f.invalid) {
      return;
    }
    const req = this.editingOperationalId
      ? this.api.put(`/expenses/${this.editingOperationalId}`, this.operationalForm)
      : this.api.post('/expenses', this.operationalForm);
    req.subscribe({
      next: () => {
        this.closeOperational();
        this.reloadOperational();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el gasto');
        this.operationalError = parsed.message;
        this.operationalApiErrors = parsed.fieldErrors;
      },
    });
  }

  async removeOperational(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este gasto?');
    if (!ok) return;
    this.api.delete(`/expenses/${id}`).subscribe(() => this.reloadOperational());
  }
}
