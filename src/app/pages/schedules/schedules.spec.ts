import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DateSelectArg, EventClickArg } from '@fullcalendar/core';
import { of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Branch, ClassSchedule, Instructor } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { SchedulesPage } from './schedules';

describe('SchedulesPage', () => {
  let component: SchedulesPage;
  let api: jasmine.SpyObj<ApiService>;
  let confirm: jasmine.SpyObj<ConfirmService>;

  const branch: Branch = { id: 1, name: 'Centro', is_active: true, color: '#C45C26' };
  const otherBranch: Branch = { id: 2, name: 'Norte', is_active: true, color: '#1F6B4A' };
  const instructor: Instructor = {
    id: 5,
    name: 'Sensei Koji',
    is_active: true,
    color: '#3B82F6',
  };
  const schedule: ClassSchedule = {
    id: 100,
    instructor_id: 5,
    branch_id: 1,
    day_of_week: 1,
    start_time: '18:00:00',
    end_time: '20:00:00',
    is_active: true,
    instructor,
    branch,
  };
  const inactiveSchedule: ClassSchedule = {
    id: 101,
    instructor_id: 5,
    branch_id: 1,
    day_of_week: 3,
    start_time: '10:00:00',
    end_time: '11:00:00',
    is_active: false,
    instructor,
    branch,
  };
  const northSchedule: ClassSchedule = {
    id: 200,
    instructor_id: 5,
    branch_id: 2,
    day_of_week: 2,
    start_time: '09:00:00',
    end_time: '10:00:00',
    is_active: true,
    instructor,
    branch: otherBranch,
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
    confirm = jasmine.createSpyObj('ConfirmService', ['ask']);

    api.get.and.callFake(((path: string, params?: Record<string, unknown>) => {
      if (path === '/instructors') {
        return of([instructor]);
      }
      if (path === '/branches') {
        return of([branch, otherBranch]);
      }
      if (path === '/class-schedules') {
        if (params && 'page' in params) {
          return of({
            data: [schedule],
            meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
          });
        }
        return of([schedule, inactiveSchedule, northSchedule]);
      }
      return of([]);
    }) as ApiService['get']);

    await TestBed.configureTestingModule({
      imports: [SchedulesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
      ],
    })
      .overrideComponent(SchedulesPage, {
        set: {
          template: '',
          imports: [FormsModule],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(SchedulesPage);
    component = fixture.componentInstance;
  });

  it('crea el componente', () => {
    expect(component).toBeTruthy();
  });

  it('configura FullCalendar timeGridWeek lun–dom 07–21 slots 1h', () => {
    expect(component.calendarOptions.initialView).toBe('timeGridWeek');
    expect(component.calendarOptions.firstDay).toBe(1);
    expect(component.calendarOptions.slotMinTime).toBe('07:00:00');
    expect(component.calendarOptions.slotMaxTime).toBe('21:00:00');
    expect(component.calendarOptions.slotDuration).toBe('01:00:00');
    expect(component.calendarOptions.allDaySlot).toBeFalse();
    expect(component.calendarOptions.selectable).toBeTrue();
    expect(component.calendarOptions.editable).toBeTrue();
    expect(component.calendarOptions.eventDurationEditable).toBeTrue();
    expect(component.calendarOptions.eventResizableFromStart).toBeTrue();
    expect(component.calendarOptions.eventStartEditable).toBeFalse();
    expect(component.calendarOptions.snapDuration).toBe('01:00:00');
    expect(component.calendarOptions.headerToolbar).toBeFalse();
    expect(component.calendarOptions.locale).toBeTruthy();
    expect(component.calendarOptions.plugins?.length).toBeGreaterThan(0);
  });

  it('al iniciar carga instructores, sucursales y listado paginado', () => {
    component.ngOnInit();

    expect(component.instructors()).toEqual([instructor]);
    expect(component.branches()).toEqual([branch, otherBranch]);
    expect(component.items()).toEqual([schedule]);
    expect(api.get).toHaveBeenCalledWith('/class-schedules', jasmine.objectContaining({ page: 1 }));
  });

  it('dayName resuelve el día de la semana', () => {
    expect(component.dayName(1)).toBe('Lunes');
    expect(component.dayName(0)).toBe('Domingo');
  });

  it('setViewMode calendar carga todos los horarios y un panel por sucursal', fakeAsync(() => {
    component.ngOnInit();
    api.get.calls.reset();

    component.setViewMode('calendar');
    tick();

    expect(component.viewMode()).toBe('calendar');
    expect(api.get).toHaveBeenCalledWith('/class-schedules');
    expect(component.calendarItems().map((s) => s.id)).toEqual([100, 101, 200]);
    expect(component.branchPanels().map((p) => p.branch.id)).toEqual([1, 2]);
    expect(component.isBranchOpen(1)).toBeTrue();
    expect(component.optionsForBranch(1)?.events).toEqual(
      jasmine.arrayWithExactContents([
        jasmine.objectContaining({ id: '100' }),
        jasmine.objectContaining({ id: '101' }),
      ]),
    );
    expect(component.optionsForBranch(2)?.events).toEqual([
      jasmine.objectContaining({ id: '200' }),
    ]);
  }));

  it('setViewMode list vuelve a cargar el listado paginado', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();
    api.get.calls.reset();

    component.setViewMode('list');

    expect(component.viewMode()).toBe('list');
    expect(api.get).toHaveBeenCalledWith('/class-schedules', jasmine.objectContaining({ page: 1 }));
  }));

  it('toggleBranch expande y colapsa el acordeón', () => {
    component.ngOnInit();

    component.toggleBranch(2);
    expect(component.isBranchOpen(2)).toBeTrue();

    component.toggleBranch(2);
    expect(component.isBranchOpen(2)).toBeFalse();
  });

  it('mapea eventos con título de profesor, color e inactivo', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();

    const events = component.optionsForBranch(1)?.events as Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      classNames?: string[];
      backgroundColor?: string;
      borderColor?: string;
      textColor?: string;
    }>;

    const active = events.find((e) => e.id === '100');
    const inactive = events.find((e) => e.id === '101');

    expect(active?.title).toBe('Sensei Koji');
    expect(active?.start).toMatch(/T18:00:00$/);
    expect(active?.end).toMatch(/T20:00:00$/);
    expect(active?.backgroundColor).toBe('#3B82F6');
    expect(active?.borderColor).toBe('#3B82F6');
    expect(active?.textColor).toBe('#FFFFFF');
    expect(inactive?.title).toBe('Sensei Koji (inactivo)');
    expect(inactive?.classNames).toContain('is-inactive-schedule');
    expect(inactive?.backgroundColor).toBeUndefined();
    expect(inactive?.borderColor).toBeUndefined();
  }));

  it('expone color de sucursal en paneles del acordeón', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();

    const panels = component.branchPanels();
    expect(panels.find((p) => p.branch.id === 1)?.branch.color).toBe('#C45C26');
    expect(panels.find((p) => p.branch.id === 2)?.branch.color).toBe('#1F6B4A');
  }));

  it('select en calendario abre modal con sucursal del panel', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();

    const unselect = jasmine.createSpy('unselect');
    const start = new Date(2026, 6, 27, 18, 0, 0); // lunes
    const end = new Date(2026, 6, 27, 20, 0, 0);
    const info = {
      start,
      end,
      view: { calendar: { unselect } },
    } as unknown as DateSelectArg;

    component.optionsForBranch(2)?.select?.(info);

    expect(component.formOpen()).toBeTrue();
    expect(component.editingId).toBeNull();
    expect(component.form.day_of_week).toBe(1);
    expect(component.form.start_time).toBe('18:00');
    expect(component.form.end_time).toBe('20:00');
    expect(component.form.branch_id).toBe(2);
    expect(unselect).toHaveBeenCalled();
  }));

  it('eventClick abre edición del horario', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();

    const info = {
      event: { id: '100' },
    } as unknown as EventClickArg;

    component.optionsForBranch(1)?.eventClick?.(info);

    expect(component.formOpen()).toBeTrue();
    expect(component.editingId).toBe(100);
    expect(component.form.start_time).toBe('18:00');
    expect(component.form.end_time).toBe('20:00');
  }));

  it('openCreate no impone sucursal en vista calendario', () => {
    component.ngOnInit();
    component.viewMode.set('calendar');

    component.openCreate();

    expect(component.formOpen()).toBeTrue();
    expect(component.form.branch_id).toBeUndefined();
  });

  it('save crea horario y recarga todos los calendarios', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();
    const payload = {
      instructor_id: 5,
      branch_id: 1,
      day_of_week: 2,
      start_time: '09:00',
      end_time: '10:00',
      is_active: true,
    };
    component.form = { ...payload };
    component.formOpen.set(true);
    api.post.and.returnValue(of({ id: 300 }));
    api.get.calls.reset();

    component.save({ invalid: false } as import('@angular/forms').NgForm);

    expect(api.post).toHaveBeenCalledWith('/class-schedules', payload);
    expect(component.formOpen()).toBeFalse();
    expect(api.get).toHaveBeenCalledWith('/class-schedules');
  }));

  it('save edita horario existente', () => {
    component.ngOnInit();
    component.editingId = 100;
    const payload = {
      instructor_id: 5,
      branch_id: 1,
      day_of_week: 1,
      start_time: '19:00',
      end_time: '21:00',
      is_active: true,
    };
    component.form = { ...payload };
    api.put.and.returnValue(of({ id: 100 }));

    component.save({ invalid: false } as import('@angular/forms').NgForm);

    expect(api.put).toHaveBeenCalledWith('/class-schedules/100', payload);
  });

  it('remove elimina tras confirmación', async () => {
    component.ngOnInit();
    confirm.ask.and.returnValue(Promise.resolve(true));
    api.delete.and.returnValue(of(null));

    await component.remove(100);

    expect(confirm.ask).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('/class-schedules/100');
  });

  it('remove no elimina si se cancela', async () => {
    component.ngOnInit();
    confirm.ask.and.returnValue(Promise.resolve(false));

    await component.remove(100);

    expect(api.delete).not.toHaveBeenCalled();
  });

  it('eventResize guarda nuevas horas del bloque', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();
    api.put.and.returnValue(of({ id: 100 }));

    const start = new Date(2026, 6, 27, 17, 0, 0);
    const end = new Date(2026, 6, 27, 20, 0, 0);
    const revert = jasmine.createSpy('revert');
    const info = {
      event: { id: '100', start, end },
      revert,
    };

    (component.optionsForBranch(1)?.eventResize as ((arg: typeof info) => void) | undefined)?.(info);

    expect(api.put).toHaveBeenCalledWith('/class-schedules/100', {
      instructor_id: 5,
      branch_id: 1,
      day_of_week: 1,
      start_time: '17:00',
      end_time: '20:00',
      is_active: true,
      notes: '',
    });
    expect(component.calendarItems().find((s) => s.id === 100)?.start_time).toBe('17:00');
    expect(component.calendarItems().find((s) => s.id === 100)?.end_time).toBe('20:00');
    expect(revert).not.toHaveBeenCalled();
  }));

  it('eventDidMount agrega botón eliminar en el evento', fakeAsync(() => {
    component.ngOnInit();
    component.setViewMode('calendar');
    tick();

    const el = document.createElement('div');
    const info = {
      event: { id: '100' },
      el,
    } as unknown as import('@fullcalendar/core').EventMountArg;

    component.optionsForBranch(1)?.eventDidMount?.(info);

    const btn = el.querySelector('.fc-event-delete') as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.getAttribute('aria-label')).toBe('Eliminar horario');
  }));

  it('removeFromForm elimina el horario en edición', async () => {
    component.ngOnInit();
    component.editingId = 100;
    component.formOpen.set(true);
    confirm.ask.and.returnValue(Promise.resolve(true));
    api.delete.and.returnValue(of(null));

    await component.removeFromForm();

    expect(api.delete).toHaveBeenCalledWith('/class-schedules/100');
    expect(component.formOpen()).toBeFalse();
  });
});
