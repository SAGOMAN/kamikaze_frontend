import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, Product, Sale } from '../../core/models';

interface DraftItem {
  product_id: number | null;
  quantity: number;
}

@Component({
  selector: 'app-sales',
  imports: [FormsModule],
  templateUrl: './sales.html',
})
export class SalesPage implements OnInit {
  readonly sales = signal<Sale[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly products = signal<Product[]>([]);
  branchId: number | null = null;
  saleDate = new Date().toISOString().slice(0, 10);
  notes = '';
  items: DraftItem[] = [{ product_id: null, quantity: 1 }];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => {
      this.branches.set(data);
      this.branchId = data[0]?.id ?? null;
    });
    this.api.get<Product[]>('/products', { is_active: true }).subscribe((data) => this.products.set(data));
    this.reload();
  }

  reload() {
    this.api.get<Sale[]>('/sales').subscribe((data) => this.sales.set(data));
  }

  addItem() {
    this.items.push({ product_id: null, quantity: 1 });
  }

  save() {
    this.api
      .post('/sales', {
        branch_id: this.branchId,
        sale_date: this.saleDate,
        notes: this.notes,
        items: this.items.filter((i) => i.product_id),
      })
      .subscribe({
        next: () => {
          this.notes = '';
          this.items = [{ product_id: null, quantity: 1 }];
          this.reload();
        },
        error: (err) => alert(err?.error?.message || err?.error?.items?.[0] || 'Error al registrar venta'),
      });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar venta y devolver stock?')) return;
    this.api.delete(`/sales/${id}`).subscribe(() => this.reload());
  }
}
