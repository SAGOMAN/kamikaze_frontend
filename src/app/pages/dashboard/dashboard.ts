import { Component, ElementRef, HostListener, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, PeriodReport, PeriodReportBranch, ReportPeriodType } from '../../core/models';
import { TimestampPipe } from '../../shared/date/timestamp.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, TimestampPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardPage implements OnInit {
  period: ReportPeriodType = 'month';
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  quarter = Math.floor(new Date().getMonth() / 3) + 1;
  semester = new Date().getMonth() < 6 ? 1 : 2;

  readonly report = signal<PeriodReport | null>(null);
  readonly error = signal('');
  readonly exporting = signal(false);
  readonly branches = signal<Branch[]>([]);
  readonly selectedBranchIds = signal<number[]>([]);
  readonly branchMenuOpen = signal(false);

  private readonly branchMenu = viewChild<ElementRef<HTMLElement>>('branchMenu');

  readonly monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe({
      next: (data) => {
        const active = data.filter((b) => b.is_active);
        this.branches.set(active);
        this.selectedBranchIds.set(active.map((b) => b.id));
        this.load();
      },
      error: () => {
        this.error.set('No se pudieron cargar las sucursales');
        this.load();
      },
    });
  }

  showBranchFilter(): boolean {
    return this.branches().length > 1;
  }

  allBranchesSelected(): boolean {
    const ids = this.selectedBranchIds();
    const available = this.branches();
    return available.length > 0 && ids.length === available.length && available.every((b) => ids.includes(b.id));
  }

  isBranchSelected(id: number): boolean {
    return this.selectedBranchIds().includes(id);
  }

  branchFilterLabel(): string {
    const selected = this.selectedBranchIds();
    const available = this.branches();
    if (!available.length || this.allBranchesSelected()) {
      return 'Todas las sucursales';
    }
    if (selected.length === 1) {
      return available.find((b) => b.id === selected[0])?.name ?? '1 sucursal';
    }
    return `${selected.length} sucursales`;
  }

  toggleBranchMenu(event: Event) {
    event.stopPropagation();
    this.branchMenuOpen.update((open) => !open);
  }

  toggleAllBranches(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked || this.branches().length <= 1) {
      this.selectedBranchIds.set(this.branches().map((b) => b.id));
      this.load();
      return;
    }
    (event.target as HTMLInputElement).checked = true;
  }

  toggleBranch(id: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.selectedBranchIds();
    if (checked) {
      this.selectedBranchIds.set([...current, id]);
      this.load();
      return;
    }
    if (current.length <= 1) {
      (event.target as HTMLInputElement).checked = true;
      return;
    }
    this.selectedBranchIds.set(current.filter((item) => item !== id));
    this.load();
  }

  showBranchBreakdown(): boolean {
    return this.selectedBranchIds().length > 1;
  }

  incomeBarPct(row: PeriodReportBranch): number {
    const max = Math.max(0, ...(this.report()?.by_branch ?? []).map((item) => item.income.total));
    if (max <= 0) {
      return 0;
    }
    return (row.income.total / max) * 100;
  }

  expenseBarPct(row: PeriodReportBranch): number {
    const max = Math.max(0, ...(this.report()?.by_branch ?? []).map((item) => item.expenses.total));
    if (max <= 0) {
      return 0;
    }
    return (row.expenses.total / max) * 100;
  }

  load() {
    this.error.set('');
    this.api.get<PeriodReport>('/reports/period', this.queryParams()).subscribe({
      next: (data) => this.report.set(data),
      error: () => {
        this.report.set(null);
        this.error.set('No se pudo cargar el reporte');
      },
    });
  }

  exportExcel() {
    this.exporting.set(true);
    this.error.set('');
    this.api.getBlob('/reports/period/export', this.queryParams()).subscribe({
      next: (res) => {
        const blob = res.body;
        if (!blob) {
          this.error.set('No se pudo exportar el Excel');
          this.exporting.set(false);
          return;
        }
        const disposition = res.headers.get('content-disposition') || '';
        const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        const filename = match ? match[1].replace(/['"]/g, '') : `resumen-${this.year}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.error.set('No se pudo exportar el Excel');
        this.exporting.set(false);
      },
    });
  }

  money(value: number | undefined) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0);
  }

  monthLabel(year: number, month: number) {
    return `${this.monthNames[month - 1] ?? month} ${year}`;
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    if (!this.branchMenuOpen()) {
      return;
    }
    const root = this.branchMenu()?.nativeElement;
    if (root && !root.contains(event.target as Node)) {
      this.branchMenuOpen.set(false);
    }
  }

  queryParams(): Record<string, string | number | number[]> {
    const params: Record<string, string | number | number[]> = {
      period: this.period,
      year: this.year,
    };
    if (this.period === 'month') {
      params['month'] = this.month;
    } else if (this.period === 'quarter') {
      params['quarter'] = this.quarter;
    } else if (this.period === 'semester') {
      params['semester'] = this.semester;
    }
    if (this.selectedBranchIds().length && !this.allBranchesSelected()) {
      params['branch_ids'] = this.selectedBranchIds();
    }
    return params;
  }
}
