import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, Product, ProductStock } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-products',
  imports: [FormsModule, Modal],
  templateUrl: './products.html',
})
export class ProductsPage implements OnInit {
  readonly products = signal<Product[]>([]);
  readonly stocks = signal<ProductStock[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly formOpen = signal(false);
  readonly stockOpen = signal(false);
  form: Partial<Product> = { name: '', sku: '', unit_price: 0, is_active: true };
  editingId: number | null = null;
  stockForm = { product_id: null as number | null, branch_id: null as number | null, quantity: 0 };

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => this.branches.set(data));
    this.reload();
  }

  reload() {
    this.api.get<Product[]>('/products').subscribe((data) => this.products.set(data));
    this.api.get<ProductStock[]>('/product-stocks').subscribe((data) => this.stocks.set(data));
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
      this.reload();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este producto?');
    if (!ok) return;
    this.api.delete(`/products/${id}`).subscribe(() => this.reload());
  }

  saveStock() {
    this.api.put('/product-stocks', this.stockForm).subscribe(() => {
      this.closeStock();
      this.reload();
    });
  }
}
