import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, Expense } from '../../core/models';

@Component({
  selector: 'app-expenses',
  imports: [FormsModule],
  templateUrl: './expenses.html',
})
export class ExpensesPage implements OnInit {
  readonly items = signal<Expense[]>([]);
  readonly branches = signal<Branch[]>([]);
  form: Partial<Expense> = {
    category: '',
    description: '',
    amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
    branch_id: null,
    notes: '',
  };
  editingId: number | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => this.branches.set(data));
    this.reload();
  }

  reload() {
    this.api.get<Expense[]>('/expenses').subscribe((data) => this.items.set(data));
  }

  edit(item: Expense) {
    this.editingId = item.id;
    this.form = {
      ...item,
      expense_date: String(item.expense_date).slice(0, 10),
    };
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
      this.reset();
      this.reload();
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar gasto?')) return;
    this.api.delete(`/expenses/${id}`).subscribe(() => this.reload());
  }
}
