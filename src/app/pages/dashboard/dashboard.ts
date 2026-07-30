import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { MonthlyReport } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.html',
})
export class DashboardPage implements OnInit {
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  readonly report = signal<MonthlyReport | null>(null);
  readonly error = signal('');

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.error.set('');
    this.api.get<MonthlyReport>('/reports/monthly', { year: this.year, month: this.month }).subscribe({
      next: (data) => this.report.set(data),
      error: () => this.error.set('No se pudo cargar el reporte'),
    });
  }

  money(value: number | undefined) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0);
  }
}
