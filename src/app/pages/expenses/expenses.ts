import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, Expense } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-expenses',
  imports: [FormsModule, Modal],
  templateUrl: './expenses.html',
})
export class ExpensesPage implements OnInit {
  readonly items = signal<Expense[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly formOpen = signal(false);
  form: Partial<Expense> = {
    category: '',
    description: '',
    amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
    branch_id: null,
    notes: '',
  };
  editingId: number | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => this.branches.set(data));
    this.reload();
  }

  reload() {
    this.api.get<Expense[]>('/expenses').subscribe((data) => this.items.set(data));
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
  }

  edit(item: Expense) {
    this.editingId = item.id;
    this.form = {
      ...item,
      expense_date: String(item.expense_date).slice(0, 10),
    };
    this.formOpen.set(true);
  }

  closeForm() {
    this.reset();
    this.formOpen.set(false);
  }

  reset() {
    this.editingId = null;
    this.form = {
      category: '',
      description: '',
      amount: 0,
      expense_date: new Date().toISOString().slice(0, 10),
      branch_id: null,
      notes: '',
    };
  }

  save() {
    const req = this.editingId
      ? this.api.put(`/expenses/${this.editingId}`, this.form)
      : this.api.post('/expenses', this.form);
    req.subscribe(() => {
      this.closeForm();
      this.reload();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este gasto?');
    if (!ok) return;
    this.api.delete(`/expenses/${id}`).subscribe(() => this.reload());
  }
}
