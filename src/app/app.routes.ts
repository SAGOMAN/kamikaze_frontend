import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { authGuard } from './core/auth/auth.guard';
import { AdminLayout } from './layout/admin-layout';
import { LoginPage } from './pages/login/login';
import { DashboardPage } from './pages/dashboard/dashboard';
import { BranchesPage } from './pages/branches/branches';
import { StudentsPage } from './pages/students/students';
import { PaymentsPage } from './pages/payments/payments';
import { AttendancePage } from './pages/attendance/attendance';
import { InventoryPage } from './pages/inventory/inventory';
import { CatalogsPage } from './pages/catalogs/catalogs';
import { SalesPage } from './pages/sales/sales';
import { InstructorsPage } from './pages/instructors/instructors';
import { SchedulesPage } from './pages/schedules/schedules';
import { UsersPage } from './pages/users/users';

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
      { path: 'inventory', component: InventoryPage },
      { path: 'catalogs', component: CatalogsPage },
      { path: 'catalogs/:id', component: CatalogsPage },
      { path: 'products', redirectTo: () => '/app/inventory?tab=catalog', pathMatch: 'full' },
      { path: 'expenses', redirectTo: () => '/app/inventory?tab=operational', pathMatch: 'full' },
      { path: 'sales', component: SalesPage },
      { path: 'instructors', component: InstructorsPage },
      { path: 'schedules', component: SchedulesPage },
      { path: 'users', canActivate: [adminGuard], component: UsersPage },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },
  { path: '**', redirectTo: 'app/dashboard' },
];
