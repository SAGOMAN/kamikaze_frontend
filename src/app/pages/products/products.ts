import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, Product, ProductStock } from '../../core/models';

@Component({
  selector: 'app-products',
  imports: [FormsModule],
  templateUrl: './products.html',
})
export class ProductsPage implements OnInit {
  readonly products = signal<Product[]>([]);
  readonly stocks = signal<ProductStock[]>([]);
  readonly branches = signal<Branch[]>([]);
  form: Partial<Product> = { name: '', sku: '', unit_price: 0, is_active: true };
  editingId: number | null = null;
  stockForm = { product_id: null as number | null, branch_id: null as number | null, quantity: 0 };

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => this.branches.set(data));
    this.reload();
  }

  reload() {
    this.api.get<Product[]>('/products').subscribe((data) => this.products.set(data));
    this.api.get<ProductStock[]>('/product-stocks').subscribe((data) => this.stocks.set(data));
  }

  edit(item: Product) {
    this.editingId = item.id;
    this.form = { ...item };
  }

  reset() {
    this.editingId = null;
    this.form = { name: '', sku: '', unit_price: 0, is_active: true };
  }

  save() {
    const req = this.editingId
      ? this.api.put(`/products/${this.editingId}`, this.form)
      : this.api.post('/products', this.form);
    req.subscribe(() => {
      this.reset();
      this.reload();
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar producto?')) return;
    this.api.delete(`/products/${id}`).subscribe(() => this.reload());
  }

  saveStock() {
    this.api.put('/product-stocks', this.stockForm).subscribe(() => {
      this.stockForm = { product_id: null, branch_id: null, quantity: 0 };
      this.reload();
    });
  }
}
