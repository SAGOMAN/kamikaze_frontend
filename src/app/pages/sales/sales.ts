import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, Product, Sale } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Modal } from '../../shared/modal/modal';

interface DraftItem {
  product_id: number | null;
  quantity: number;
}

@Component({
  selector: 'app-sales',
  imports: [FormsModule, Modal],
  templateUrl: './sales.html',
})
export class SalesPage implements OnInit {
  readonly sales = signal<Sale[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly products = signal<Product[]>([]);
  readonly formOpen = signal(false);
  branchId: number | null = null;
  saleDate = new Date().toISOString().slice(0, 10);
  notes = '';
  items: DraftItem[] = [{ product_id: null, quantity: 1 }];
  formError = '';

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

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
    this.saleDate = new Date().toISOString().slice(0, 10);
    this.notes = '';
    this.items = [{ product_id: null, quantity: 1 }];
    this.branchId = this.branches()[0]?.id ?? null;
  }

  addItem() {
    this.items.push({ product_id: null, quantity: 1 });
  }

  save() {
    this.formError = '';
    this.api
      .post('/sales', {
        branch_id: this.branchId,
        sale_date: this.saleDate,
        notes: this.notes,
        items: this.items.filter((i) => i.product_id),
      })
      .subscribe({
        next: () => {
          this.closeForm();
          this.reload();
        },
        error: (err) => {
          this.formError = err?.error?.message || err?.error?.items?.[0] || 'Error al registrar venta';
        },
      });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask(
      '¿Está seguro de que desea eliminar esta venta? Se devolverá el stock correspondiente.',
    );
    if (!ok) return;
    this.api.delete(`/sales/${id}`).subscribe(() => this.reload());
  }
}
