import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Branch, PaginatedResponse, Product, ProductStock } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-products',
  imports: [FormsModule, Modal, ListPager],
  templateUrl: './products.html',
})
export class ProductsPage implements OnInit {
  readonly products = signal<Product[]>([]);
  readonly catalog = signal<Product[]>([]);
  readonly stocks = signal<ProductStock[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly formOpen = signal(false);
  readonly stockOpen = signal(false);
  readonly productList = new ListQueryState();
  readonly stockList = new ListQueryState();
  form: Partial<Product> = { name: '', sku: '', unit_price: 0, is_active: true };
  editingId: number | null = null;
  stockForm = { product_id: null as number | null, branch_id: null as number | null, quantity: 0 };

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => this.branches.set(data));
    this.api.get<Product[]>('/products').subscribe((data) => this.catalog.set(data));
    this.reloadProducts();
    this.reloadStocks();
  }

  reloadProducts() {
    this.api
      .get<PaginatedResponse<Product>>('/products', this.productList.params())
      .subscribe((res) => this.productList.apply(res, (data) => this.products.set(data)));
  }

  reloadStocks() {
    this.api
      .get<PaginatedResponse<ProductStock>>('/product-stocks', this.stockList.params())
      .subscribe((res) => this.stockList.apply(res, (data) => this.stocks.set(data)));
  }

  searchProducts() {
    this.productList.runSearch(() => this.reloadProducts());
  }

  searchStocks() {
    this.stockList.runSearch(() => this.reloadStocks());
  }

  goToProductPage(page: number) {
    this.productList.goToPage(page, () => this.reloadProducts());
  }

  goToStockPage(page: number) {
    this.stockList.goToPage(page, () => this.reloadStocks());
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
  }

  edit(item: Product) {
    this.editingId = item.id;
    this.form = { ...item };
    this.formOpen.set(true);
  }

  closeForm() {
    this.reset();
    this.formOpen.set(false);
  }

  reset() {
    this.editingId = null;
    this.form = { name: '', sku: '', unit_price: 0, is_active: true };
  }

  openStock() {
    this.stockForm = { product_id: null, branch_id: null, quantity: 0 };
    this.stockOpen.set(true);
  }

  closeStock() {
    this.stockForm = { product_id: null, branch_id: null, quantity: 0 };
    this.stockOpen.set(false);
  }

  save() {
    const req = this.editingId
      ? this.api.put(`/products/${this.editingId}`, this.form)
      : this.api.post('/products', this.form);
    req.subscribe(() => {
      this.closeForm();
      this.api.get<Product[]>('/products').subscribe((data) => this.catalog.set(data));
      this.reloadProducts();
      this.reloadStocks();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este producto?');
    if (!ok) return;
    this.api.delete(`/products/${id}`).subscribe(() => {
      this.api.get<Product[]>('/products').subscribe((data) => this.catalog.set(data));
      this.reloadProducts();
      this.reloadStocks();
    });
  }

  saveStock() {
    this.api.put('/product-stocks', this.stockForm).subscribe(() => {
      this.closeStock();
      this.reloadStocks();
    });
  }
}
