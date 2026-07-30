import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { MembershipPayment, Student } from '../../core/models';

@Component({
  selector: 'app-payments',
  imports: [FormsModule],
  templateUrl: './payments.html',
})
export class PaymentsPage implements OnInit {
  readonly items = signal<MembershipPayment[]>([]);
  readonly students = signal<Student[]>([]);
  form: Partial<MembershipPayment> = {
    student_id: undefined,
    amount: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    period_month: new Date().toISOString().slice(0, 7),
    payment_method: 'efectivo',
    notes: '',
  };
  editingId: number | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<Student[]>('/students', { is_active: true }).subscribe((data) => this.students.set(data));
    this.reload();
  }

  reload() {
    this.api.get<MembershipPayment[]>('/membership-payments').subscribe((data) => this.items.set(data));
  }

  studentLabel(s: Student) {
    return s.nickname ? `${s.first_name} ${s.last_name} (${s.nickname})` : `${s.first_name} ${s.last_name}`;
  }

  edit(item: MembershipPayment) {
    this.editingId = item.id;
    this.form = {
      student_id: item.student_id,
      amount: item.amount,
      payment_date: String(item.payment_date).slice(0, 10),
      period_month: item.period_month,
      payment_method: item.payment_method,
      notes: item.notes ?? '',
    };
  }

  reset() {
    this.editingId = null;
    this.form = {
      student_id: undefined,
      amount: 0,
      payment_date: new Date().toISOString().slice(0, 10),
      period_month: new Date().toISOString().slice(0, 7),
      payment_method: 'efectivo',
      notes: '',
    };
  }

  save() {
    const req = this.editingId
      ? this.api.put(`/membership-payments/${this.editingId}`, this.form)
      : this.api.post('/membership-payments', this.form);

    req.subscribe(() => {
      this.reset();
      this.reload();
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar pago?')) return;
    this.api.delete(`/membership-payments/${id}`).subscribe(() => this.reload());
  }
}
