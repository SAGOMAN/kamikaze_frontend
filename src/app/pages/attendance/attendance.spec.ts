import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Attendance, Branch, ClassSchedule, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { AttendancePage } from './attendance';

describe('AttendancePage', () => {
  let component: AttendancePage;
  let api: jasmine.SpyObj<ApiService>;
  let confirm: jasmine.SpyObj<ConfirmService>;

  const branch: Branch = { id: 1, name: 'Centro', is_active: true, color: '#C45C26' };
  const inactiveBranch: Branch = { id: 2, name: 'Cerrada', is_active: false, color: '#64748B' };
  const student: Student = {
    id: 10,
    first_name: 'Ana',
    last_name: 'Pérez',
    is_active: true,
  };
  const scheduleMorning: ClassSchedule = {
    id: 100,
    instructor_id: 5,
    branch_id: 1,
    day_of_week: 4,
    start_time: '10:00:00',
    end_time: '11:00:00',
    is_active: true,
    instructor: { id: 5, name: 'Sensei Koji', is_active: true, color: '#3B82F6' },
  };
  const scheduleEvening: ClassSchedule = {
    id: 101,
    instructor_id: 5,
    branch_id: 1,
    day_of_week: 4,
    start_time: '18:00:00',
    end_time: '20:00:00',
    is_active: true,
    instructor: { id: 5, name: 'Sensei Koji', is_active: true, color: '#3B82F6' },
  };
  const inactiveSchedule: ClassSchedule = {
    id: 102,
    instructor_id: 5,
    branch_id: 1,
    day_of_week: 4,
    start_time: '07:00:00',
    end_time: '08:00:00',
    is_active: false,
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['get', 'post', 'delete']);
    confirm = jasmine.createSpyObj('ConfirmService', ['ask']);

    api.get.and.callFake(((path: string) => {
      if (path === '/branches') {
        return of([branch, inactiveBranch]);
      }
      if (path === '/students') {
        return of({
          data: [student],
          meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        });
      }
      if (path === '/class-schedules') {
        return of([scheduleMorning, scheduleEvening, inactiveSchedule]);
      }
      if (path === '/attendances') {
        return of([] as Attendance[]);
      }
      return of([]);
    }) as ApiService['get']);

    await TestBed.configureTestingModule({
      imports: [AttendancePage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
      ],
    })
      .overrideComponent(AttendancePage, {
        set: {
          template: '',
          imports: [FormsModule],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(AttendancePage);
    component = fixture.componentInstance;
  });

  it('crea el componente', () => {
    expect(component).toBeTruthy();
  });

  it('usa instructor.name en la etiqueta del horario', () => {
    expect(component.scheduleLabel(scheduleMorning)).toBe('10:00–11:00 · Sensei Koji');
  });

  it('muestra Sin instructor cuando no hay instructor', () => {
    const withoutInstructor: ClassSchedule = { ...scheduleMorning, instructor: undefined };
    expect(component.scheduleLabel(withoutInstructor)).toBe('10:00–11:00 · Sin instructor');
  });

  it('calcula dayOfWeek local sin desfase UTC', () => {
    expect(component.dayOfWeek('2026-07-30')).toBe(4);
  });

  it('al iniciar carga sucursales activas, alumnos y horarios del día', () => {
    component.date = '2026-07-30';
    component.ngOnInit();

    expect(component.branches()).toEqual([branch]);
    expect(component.students()).toEqual([student]);
    expect(component.branchId).toBe(1);
    expect(component.schedules().map((s) => s.id)).toEqual([100, 101]);
    expect(component.scheduleId).toBe(100);
    expect(api.get).toHaveBeenCalledWith('/class-schedules', {
      branch_id: 1,
    });
    expect(api.get).toHaveBeenCalledWith('/attendances', {
      date: '2026-07-30',
      branch_id: 1,
      class_schedule_id: 100,
    });
  });

  it('selectDate cambia el día y filtra horarios del weekday', () => {
    component.date = '2026-07-30';
    component.ngOnInit();

    component.selectDate('2026-07-31');

    expect(component.date).toBe('2026-07-31');
    expect(component.schedules()).toEqual([]);
    expect(component.scheduleId).toBeNull();
  });

  it('dayCellClasses marca día seleccionado y con horario', () => {
    component.date = '2026-07-30';
    component.branchSchedules.set([scheduleMorning]);

    expect(component.dayCellClasses(new Date(2026, 6, 30))).toContain('is-selected-day');
    expect(component.dayCellClasses(new Date(2026, 6, 30))).toContain('has-schedule-day');
    expect(component.dayCellClasses(new Date(2026, 6, 31))).not.toContain('has-schedule-day');
  });

  it('configura FullCalendar en español con vista mensual', () => {
    expect(component.calendarOptions.initialView).toBe('dayGridMonth');
    expect(component.calendarOptions.locale).toBeTruthy();
    expect(component.calendarOptions.plugins?.length).toBeGreaterThan(0);
  });

  it('limpia asistencias si no hay horarios activos', () => {
    api.get.and.callFake(((path: string) => {
      if (path === '/branches') return of([branch]);
      if (path === '/students') {
        return of({
          data: [student],
          meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        });
      }
      if (path === '/class-schedules') return of([inactiveSchedule]);
      return of([]);
    }) as ApiService['get']);

    component.date = '2026-07-30';
    component.ngOnInit();

    expect(component.schedules()).toEqual([]);
    expect(component.scheduleId).toBeNull();
    expect(component.attendances()).toEqual([]);
  });

  it('marca asistencia con class_schedule_id', async () => {
    component.date = '2026-07-30';
    component.ngOnInit();
    api.post.and.returnValue(of({ id: 1 }));

    await component.toggle(student);

    expect(api.post).toHaveBeenCalledWith('/attendances', {
      student_id: 10,
      branch_id: 1,
      class_schedule_id: 100,
      attendance_date: '2026-07-30',
    });
  });

  it('quita asistencia tras confirmación', async () => {
    component.date = '2026-07-30';
    component.ngOnInit();
    component.attendances.set([
      {
        id: 55,
        student_id: 10,
        branch_id: 1,
        class_schedule_id: 100,
        attendance_date: '2026-07-30',
      },
    ]);
    confirm.ask.and.returnValue(Promise.resolve(true));
    api.delete.and.returnValue(of(null));

    await component.toggle(student);

    expect(confirm.ask).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('/attendances/55');
  });

  it('no quita asistencia si se cancela la confirmación', async () => {
    component.date = '2026-07-30';
    component.ngOnInit();
    component.attendances.set([
      {
        id: 55,
        student_id: 10,
        branch_id: 1,
        class_schedule_id: 100,
        attendance_date: '2026-07-30',
      },
    ]);
    confirm.ask.and.returnValue(Promise.resolve(false));

    await component.toggle(student);

    expect(api.delete).not.toHaveBeenCalled();
  });

  it('isPresent refleja las asistencias cargadas', () => {
    component.attendances.set([
      {
        id: 1,
        student_id: 10,
        branch_id: 1,
        class_schedule_id: 100,
        attendance_date: '2026-07-30',
      },
    ]);
    expect(component.isPresent(10)).toBeTrue();
    expect(component.isPresent(99)).toBeFalse();
  });

  it('muestra el mensaje de error al fallar el POST de asistencia', async () => {
    component.date = '2026-07-30';
    component.ngOnInit();
    api.post.and.returnValue(
      throwError(() => ({
        error: {
          message: 'El horario no corresponde al día de la fecha indicada.',
          errors: {
            class_schedule_id: ['El horario no corresponde al día de la fecha indicada.'],
          },
        },
      })),
    );

    await component.toggle(student);

    expect(component.error).toBe('El horario no corresponde al día de la fecha indicada.');
  });

  it('muestra el primer error de campo si no hay message', async () => {
    component.date = '2026-07-30';
    component.ngOnInit();
    api.post.and.returnValue(
      throwError(() => ({
        error: {
          errors: {
            branch_id: ['La sucursal no coincide con la del horario seleccionado.'],
          },
        },
      })),
    );

    await component.toggle(student);

    expect(component.error).toBe('La sucursal no coincide con la del horario seleccionado.');
  });

  it('limpia el error al cambiar de fecha', () => {
    component.date = '2026-07-30';
    component.ngOnInit();
    component.error = 'Error previo';

    component.selectDate('2026-07-31');

    expect(component.error).toBe('');
  });
});
