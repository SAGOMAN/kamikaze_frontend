import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { PeriodReport, ReportPeriodType } from '../../core/models';
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
    this.load();
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

  private queryParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {
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
    return params;
  }
}
