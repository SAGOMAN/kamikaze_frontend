import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Branch, PeriodReport } from '../../core/models';
import { DashboardPage } from './dashboard';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;
  let api: jasmine.SpyObj<ApiService>;

  const centro: Branch = { id: 1, name: 'Centro', is_active: true, color: '#C45C26' };
  const norte: Branch = { id: 2, name: 'Norte', is_active: true, color: '#2563EB' };
  const inactive: Branch = { id: 3, name: 'Cerrada', is_active: false, color: '#64748B' };

  const emptyBucket = {
    income: { membership_payments: 0, sales: 0, total: 0 },
    expenses: { total: 0, merchandise: 0, operational: 0 },
    balance: 0,
  };

  const report: PeriodReport = {
    period: 'month',
    year: 2026,
    month: 8,
    from: '2026-08-01',
    to: '2026-08-31',
    label: '08/2026',
    sucursales_label: 'Todas',
    income: { membership_payments: 400, sales: 230, total: 630 },
    expenses: { total: 80, merchandise: 0, operational: 80 },
    balance: 550,
    months: [{ year: 2026, month: 8, ...emptyBucket }],
    by_branch: [
      { id: 1, name: 'Centro', income: { membership_payments: 0, sales: 150, total: 150 }, expenses: { total: 50, merchandise: 0, operational: 50 }, balance: 100 },
      { id: 2, name: 'Norte', income: { membership_payments: 0, sales: 80, total: 80 }, expenses: { total: 30, merchandise: 0, operational: 30 }, balance: 50 },
      { id: null, name: 'Sin sucursal', income: { membership_payments: 400, sales: 0, total: 400 }, expenses: { total: 0, merchandise: 0, operational: 0 }, balance: 400 },
    ],
    tops: {
      sales: [],
      expenses: [],
      membership_payments: [],
      attendances_by_student: [],
    },
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['get', 'getBlob']);
    api.get.and.callFake(((path: string) => {
      if (path === '/branches') {
        return of([centro, norte, inactive]);
      }
      return of(report);
    }) as ApiService['get']);

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga sucursales activas, selecciona todas y no envía branch_ids', () => {
    expect(component.branches()).toEqual([centro, norte]);
    expect(component.selectedBranchIds()).toEqual([1, 2]);
    expect(component.showBranchFilter()).toBeTrue();
    expect(component.allBranchesSelected()).toBeTrue();
    expect(component.queryParams()['branch_ids']).toBeUndefined();
  });

  it('oculta el multi-select si solo hay una sucursal activa', () => {
    api.get.and.callFake(((path: string) => {
      if (path === '/branches') {
        return of([centro, inactive]);
      }
      return of(report);
    }) as ApiService['get']);

    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.showBranchFilter()).toBeFalse();
    expect(component.selectedBranchIds()).toEqual([1]);
  });

  it('al desmarcar una sucursal recarga el reporte con branch_ids', () => {
    api.get.calls.reset();
    api.get.and.returnValue(of(report));

    const event = { target: { checked: false } } as unknown as Event;
    component.toggleBranch(2, event);

    expect(component.selectedBranchIds()).toEqual([1]);
    expect(component.showBranchBreakdown()).toBeFalse();
    expect(component.queryParams()['branch_ids']).toEqual([1]);
    expect(api.get).toHaveBeenCalledWith('/reports/period', jasmine.objectContaining({ branch_ids: [1] }));
  });

  it('no deja el filtro vacío al desmarcar la última sucursal', () => {
    component.selectedBranchIds.set([1]);
    const checkbox = { checked: false };
    component.toggleBranch(1, { target: checkbox } as unknown as Event);

    expect(component.selectedBranchIds()).toEqual([1]);
    expect(checkbox.checked).toBeTrue();
  });

  it('Seleccionar todas vuelve a omitir branch_ids', () => {
    component.selectedBranchIds.set([1]);
    api.get.calls.reset();
    api.get.and.returnValue(of(report));

    component.toggleAllBranches({ target: { checked: true } } as unknown as Event);

    expect(component.allBranchesSelected()).toBeTrue();
    expect(component.queryParams()['branch_ids']).toBeUndefined();
  });
});
