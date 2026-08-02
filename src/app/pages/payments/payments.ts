import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { MembershipPayment, PaginatedResponse, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { TimestampPipe } from '../../shared/date/timestamp.pipe';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';
import { SearchableSelect } from '../../shared/searchable-select/searchable-select';

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

@Component({
  selector: 'app-payments',
  imports: [FormsModule, Modal, TimestampPipe, ListPager, FieldError, SearchableSelect],
  templateUrl: './payments.html',
})
export class PaymentsPage implements OnInit {
  readonly items = signal<MembershipPayment[]>([]);
  readonly students = signal<Student[]>([]);
  readonly formOpen = signal(false);
  readonly list = new ListQueryState();

  readonly selectedStudentId = signal<number | null>(null);
  readonly selectedYear = signal(new Date().getFullYear());
  readonly selectedPeriod = signal<string | null>(null);
  readonly studentYearPayments = signal<MembershipPayment[]>([]);
  readonly yearLoading = signal(false);

  readonly studentOptions = computed(() =>
    this.students().map((s) => ({
      value: s.id,
      label: this.studentLabel(s),
    })),
  );

  readonly yearOptions = (() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current + 1; y >= current - 5; y--) {
      years.push(y);
    }
    return years;
  })();

  readonly paymentsByPeriod = computed(() => {
    const map = new Map<string, MembershipPayment[]>();
    for (const payment of this.studentYearPayments()) {
      const list = map.get(payment.period_month) ?? [];
      list.push(payment);
      map.set(payment.period_month, list);
    }
    return map;
  });

  readonly monthCells = computed(() => {
    const year = this.selectedYear();
    const byPeriod = this.paymentsByPeriod();
    return MONTH_LABELS.map((label, index) => {
      const month = String(index + 1).padStart(2, '0');
      const period = `${year}-${month}`;
      const payments = byPeriod.get(period) ?? [];
      const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return {
        label,
        period,
        paid: payments.length > 0,
        count: payments.length,
        total,
      };
    });
  });

  readonly selectedMonthPayments = computed(() => {
    const period = this.selectedPeriod();
    if (!period) return [];
    return this.paymentsByPeriod().get(period) ?? [];
  });

  readonly selectedMonthTotal = computed(() =>
    this.selectedMonthPayments().reduce((sum, p) => sum + Number(p.amount || 0), 0),
  );

  form: Partial<MembershipPayment> = {
    student_id: undefined,
    amount: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    period_month: new Date().toISOString().slice(0, 7),
    payment_method: 'efectivo',
    notes: '',
  };
  editingId: number | null = null;
  /** Cuando el alta viene del Gantt, el período no se edita libremente. */
  periodLocked = false;
  formError = '';
  apiErrors: Record<string, string> = {};
  readonly showInvalid = showInvalid;
  readonly monthLabels = MONTH_LABELS;

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Student[]>('/students', { is_active: true }).subscribe((data) => {
      this.students.set(data);
      if (data.length && this.selectedStudentId() === null) {
        this.selectedStudentId.set(data[0].id);
        this.selectedPeriod.set(this.periodForCurrentMonth());
        this.reloadYear();
      }
    });
    this.reload();
  }

  /** Período YYYY-MM del mes calendario actual, en el año seleccionado. */
  private periodForCurrentMonth(): string {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `${this.selectedYear()}-${month}`;
  }

  reload() {
    this.api
      .get<PaginatedResponse<MembershipPayment>>('/membership-payments', this.list.params())
      .subscribe((res) => this.list.apply(res, (data) => this.items.set(data)));
  }

  reloadYear() {
    const studentId = this.selectedStudentId();
    if (!studentId) {
      this.studentYearPayments.set([]);
      this.selectedPeriod.set(null);
      return;
    }
    this.yearLoading.set(true);
    this.api
      .get<MembershipPayment[]>('/membership-payments', {
        student_id: studentId,
        year: this.selectedYear(),
      })
      .subscribe({
        next: (data) => {
          this.studentYearPayments.set(Array.isArray(data) ? data : []);
          this.yearLoading.set(false);
          const period = this.selectedPeriod();
          if (period && !period.startsWith(`${this.selectedYear()}-`)) {
            this.selectedPeriod.set(null);
          }
        },
        error: () => {
          this.studentYearPayments.set([]);
          this.yearLoading.set(false);
        },
      });
  }

  onStudentChange(id: number | string | null) {
    const value = id === null || id === '' || id === undefined ? null : Number(id);
    this.selectedStudentId.set(value);
    this.selectedPeriod.set(value ? this.periodForCurrentMonth() : null);
    this.reloadYear();
  }

  onYearChange(year: number | string) {
    this.selectedYear.set(Number(year));
    this.selectedPeriod.set(this.selectedStudentId() ? this.periodForCurrentMonth() : null);
    this.reloadYear();
  }

  selectMonth(period: string) {
    this.selectedPeriod.set(period);
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

  formatMoney(value: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0);
  }

  monthTitle(period: string) {
    const [, mm] = period.split('-');
    const idx = Number(mm) - 1;
    const label = this.monthLabels[idx] ?? mm;
    return `${label} ${period.slice(0, 4)}`;
  }

  openCreateFromMonth() {
    const studentId = this.selectedStudentId();
    const period = this.selectedPeriod();
    if (!studentId || !period) return;
    this.reset();
    this.form.student_id = studentId;
    this.form.period_month = period;
    this.periodLocked = true;
    this.formOpen.set(true);
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
  }

  edit(item: MembershipPayment) {
    this.editingId = item.id;
    this.formError = '';
    this.apiErrors = {};
    this.periodLocked = false;
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
    this.formError = '';
    this.apiErrors = {};
    this.periodLocked = false;
    this.form = {
      student_id: undefined,
      amount: 0,
      payment_date: new Date().toISOString().slice(0, 10),
      period_month: new Date().toISOString().slice(0, 7),
      payment_method: 'efectivo',
      notes: '',
    };
  }

  save(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
    const req = this.editingId
      ? this.api.put(`/membership-payments/${this.editingId}`, this.form)
      : this.api.post('/membership-payments', this.form);

    req.subscribe({
      next: () => {
        this.closeForm();
        this.reload();
        this.reloadYear();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el pago');
        this.formError = parsed.message;
        this.apiErrors = parsed.fieldErrors;
      },
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este pago?');
    if (!ok) return;
    this.api.delete(`/membership-payments/${id}`).subscribe(() => {
      this.reload();
      this.reloadYear();
    });
  }
}
