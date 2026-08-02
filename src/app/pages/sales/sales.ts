import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Branch, PaginatedResponse, Product, Sale } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { TimestampPipe } from '../../shared/date/timestamp.pipe';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

interface DraftItem {
  product_id: number | null;
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
  readonly list = new ListQueryState();
  branchId: number | null = null;
  saleDate = new Date().toISOString().slice(0, 10);
  notes = '';
  items: DraftItem[] = [{ product_id: null, quantity: 1 }];
  formError = '';
  apiErrors: Record<string, string> = {};
  readonly showInvalid = showInvalid;

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
    this.api
      .get<PaginatedResponse<Sale>>('/sales', this.list.params())
      .subscribe((res) => this.list.apply(res, (data) => this.sales.set(data)));
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
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
    this.saleDate = new Date().toISOString().slice(0, 10);
    this.notes = '';
    this.items = [{ product_id: null, quantity: 1 }];
    this.branchId = this.branches()[0]?.id ?? null;
  }

  addItem() {
    this.items.push({ product_id: null, quantity: 1 });
  }

  removeItem(index: number) {
    if (this.items.length <= 1) {
      return;
    }
    this.items.splice(index, 1);
  }

  /** Stock del producto en la sucursal seleccionada (0 si no hay registro). */
  stockFor(product: Product): number {
    const branchId = this.branchId;
    if (branchId == null) {
      return 0;
    }
    return product.stocks?.find((s) => s.branch_id === branchId)?.quantity ?? 0;
  }

  save(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
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
    this.api.delete(`/sales/${id}`).subscribe(() => this.reload());
  }
}
