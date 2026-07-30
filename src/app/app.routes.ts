import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AdminLayout } from './layout/admin-layout';
import { LoginPage } from './pages/login/login';
import { DashboardPage } from './pages/dashboard/dashboard';
import { BranchesPage } from './pages/branches/branches';
import { StudentsPage } from './pages/students/students';
import { PaymentsPage } from './pages/payments/payments';
import { AttendancePage } from './pages/attendance/attendance';
import { ProductsPage } from './pages/products/products';
import { SalesPage } from './pages/sales/sales';
import { ExpensesPage } from './pages/expenses/expenses';
import { InstructorsPage } from './pages/instructors/instructors';
import { SchedulesPage } from './pages/schedules/schedules';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  {
    path: 'app',
    canActivate: [authGuard],
    component: AdminLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPage },
      { path: 'branches', component: BranchesPage },
      { path: 'students', component: StudentsPage },
      { path: 'payments', component: PaymentsPage },
      { path: 'attendance', component: AttendancePage },
      { path: 'products', component: ProductsPage },
      { path: 'sales', component: SalesPage },
      { path: 'expenses', component: ExpensesPage },
      { path: 'instructors', component: InstructorsPage },
      { path: 'schedules', component: SchedulesPage },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },
  { path: '**', redirectTo: 'app/dashboard' },
];
