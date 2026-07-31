import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { MembershipPayment, PaginatedResponse, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { TimestampPipe } from '../../shared/date/timestamp.pipe';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-payments',
  imports: [FormsModule, Modal, TimestampPipe, ListPager],
  templateUrl: './payments.html',
})
export class PaymentsPage implements OnInit {
  readonly items = signal<MembershipPayment[]>([]);
  readonly students = signal<Student[]>([]);
  readonly formOpen = signal(false);
  readonly list = new ListQueryState();
  form: Partial<MembershipPayment> = {
    student_id: undefined,
    amount: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    period_month: new Date().toISOString().slice(0, 7),
    payment_method: 'efectivo',
    notes: '',
  };
  editingId: number | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Student[]>('/students', { is_active: true }).subscribe((data) => this.students.set(data));
    this.reload();
  }

  reload() {
    this.api
      .get<PaginatedResponse<MembershipPayment>>('/membership-payments', this.list.params())
      .subscribe((res) => this.list.apply(res, (data) => this.items.set(data)));
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
  }

  goToPage(page: number) {
    this.list.goToPage(page, () => this.reload());
  }

  studentLabel(s: Student) {
    return s.nickname ? `${s.first_name} ${s.last_name} (${s.nickname})` : `${s.first_name} ${s.last_name}`;
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
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
    this.formOpen.set(true);
  }

  closeForm() {
    this.reset();
    this.formOpen.set(false);
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
      this.closeForm();
      this.reload();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este pago?');
    if (!ok) return;
    this.api.delete(`/membership-payments/${id}`).subscribe(() => this.reload());
  }
}
