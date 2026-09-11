import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Attendance, Branch, ClassSchedule, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { AttendancePage } from './attendance';

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe('AttendancePage', () => {
  let component: AttendancePage;
  let fixture: ComponentFixture<AttendancePage>;
  let api: jasmine.SpyObj<ApiService>;
  let confirm: jasmine.SpyObj<ConfirmService>;

  const thursdayMorning = () => new Date(2026, 6, 30, 10, 30, 0);
  const thursdayNoon = () => new Date(2026, 6, 30, 12, 0, 0);
  const thursdayEvening = () => new Date(2026, 6, 30, 18, 30, 0);
  const textColor = hexToRgb('#1a2430');

  const branch: Branch = { id: 1, name: 'Centro', is_active: true, color: '#C45C26' };
  const norte: Branch = { id: 3, name: 'Norte', is_active: true, color: '#2563EB' };
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
  const norteMorning: ClassSchedule = {
    id: 200,
    instructor_id: 5,
    branch_id: 3,
    day_of_week: 4,
    start_time: '10:00:00',
    end_time: '11:30:00',
    is_active: true,
    branch: norte,
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
          template: `
            <span class="color-swatch" [style.background]="selectedBranchColor()"></span>
            <aside class="attendance-calendar" [style.--branch-color]="selectedBranchColor()">
              <div class="fc">
                <h2 class="fc-toolbar-title">septiembre de 2026</h2>
              </div>
            </aside>
          `,
          imports: [FormsModule],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AttendancePage);
    component = fixture.componentInstance;
    component.now = thursdayMorning;
  });

  afterEach(() => {
    component?.ngOnDestroy();
  });

  function calendarTitle(): HTMLElement {
    return fixture.nativeElement.querySelector('.fc-toolbar-title');
  }

  function calendarPanel(): HTMLElement {
    return fixture.nativeElement.querySelector('.attendance-calendar');
  }

  function render() {
    fixture.detectChanges();
  }

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

  it('al iniciar carga sucursales activas, alumnos y solo el horario en curso', () => {
    component.ngOnInit();

    expect(component.branches()).toEqual([branch]);
    expect(component.students()).toEqual([student]);
    expect(component.branchId).toBe(1);
    expect(component.date).toBe('2026-07-30');
    expect(component.schedules().map((s) => s.id)).toEqual([100]);
    expect(component.scheduleId).toBe(100);
    expect(api.get).toHaveBeenCalledWith('/class-schedules', {
      branch_id: 1,
    });
    expect(api.get).toHaveBeenCalledWith('/attendances', {
      date: '2026-07-30',
    });
  });

  it('no deja seleccionar un día distinto a hoy', () => {
    component.ngOnInit();
    component.error = 'Error previo';

    component.selectDate('2026-07-31');

    expect(component.date).toBe('2026-07-30');
    expect(component.schedules().map((s) => s.id)).toEqual([100]);
    expect(component.error).toBe('Error previo');
  });

  it('dayCellClasses marca hoy y deja no disponible el resto', () => {
    component.date = '2026-07-30';
    component.branchSchedules.set([scheduleMorning]);

    expect(component.dayCellClasses(new Date(2026, 6, 30))).toContain('is-selected-day');
    expect(component.dayCellClasses(new Date(2026, 6, 30))).toContain('has-schedule-day');
    expect(component.dayCellClasses(new Date(2026, 6, 31))).toContain('is-unavailable-day');
    expect(component.dayCellClasses(new Date(2026, 6, 31))).not.toContain('has-schedule-day');
  });

  it('configura FullCalendar en español con el mes visible y días no actuales no seleccionables', () => {
    expect(component.calendarOptions.initialView).toBe('dayGridMonth');
    expect(component.calendarOptions.locale).toBeTruthy();
    expect(component.calendarOptions.plugins?.length).toBeGreaterThan(0);
    expect(component.calendarOptions.validRange).toBeUndefined();
    expect(component.dayCellClasses(new Date(2026, 6, 31))).toContain('is-unavailable-day');
  });

  it('limpia asistencias si no hay horario en curso', () => {
    component.now = thursdayNoon;
    api.get.and.callFake(((path: string) => {
      if (path === '/branches') return of([branch]);
      if (path === '/students') {
        return of({
          data: [student],
          meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        });
      }
      if (path === '/class-schedules') return of([scheduleMorning, scheduleEvening, inactiveSchedule]);
      return of([]);
    }) as ApiService['get']);

    component.ngOnInit();

    expect(component.schedules()).toEqual([]);
    expect(component.scheduleId).toBeNull();
    expect(component.attendances()).toEqual([]);
  });

  it('en la noche solo ofrece el horario vespertino', () => {
    component.now = thursdayEvening;
    component.ngOnInit();

    expect(component.schedules().map((s) => s.id)).toEqual([101]);
    expect(component.scheduleId).toBe(101);
  });

  it('marca asistencia con class_schedule_id', async () => {
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

  it('no marca si el alumno ya está presente en otra sucursal', async () => {
    component.ngOnInit();
    component.todayAttendances.set([
      {
        id: 9,
        student_id: 10,
        branch_id: 3,
        class_schedule_id: 200,
        attendance_date: '2026-07-30',
        branch: norte,
        class_schedule: norteMorning,
      },
    ]);
    api.post.and.returnValue(of({ id: 1 }));

    await component.toggle(student);

    expect(api.post).not.toHaveBeenCalled();
    expect(component.elsewhereAttendance(10)?.branch?.name).toBe('Norte');
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
    component.ngOnInit();
    api.post.and.returnValue(
      throwError(() => ({
        error: {
          message: 'El horario no corresponde a la clase en curso.',
          errors: {
            class_schedule_id: ['El horario no corresponde a la clase en curso.'],
          },
        },
      })),
    );

    await component.toggle(student);

    expect(component.error).toBe('El horario no corresponde a la clase en curso.');
  });

  it('muestra el primer error de campo si no hay message', async () => {
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

  it('limpia el error al cambiar de sucursal', () => {
    component.ngOnInit();
    component.error = 'Error previo';

    component.onBranchChange();

    expect(component.error).toBe('');
  });

  it('expone el color de la sucursal seleccionada', () => {
    component.ngOnInit();

    expect(component.selectedBranchColor()).toBe('#C45C26');

    component.branches.set([branch, norte]);
    component.branchId = norte.id;

    expect(component.selectedBranchColor()).toBe('#2563EB');
  });

  it('usa color de respaldo si no hay sucursal seleccionada', () => {
    expect(component.selectedBranchColor()).toBe('#64748B');
  });

  it('pinta el swatch y el fondo del título con el color de sucursal, no el texto', () => {
    render();

    const titleStyle = getComputedStyle(calendarTitle());
    const swatch = fixture.nativeElement.querySelector('.color-swatch') as HTMLElement;

    expect(getComputedStyle(calendarPanel()).getPropertyValue('--branch-color').trim()).toBe('#C45C26');
    expect(getComputedStyle(swatch).backgroundColor).toBe(hexToRgb('#C45C26'));
    expect(titleStyle.backgroundColor).toBe(hexToRgb('#C45C26'));
    expect(titleStyle.color).toBe(textColor);
    expect(titleStyle.color).not.toBe(titleStyle.backgroundColor);
  });

  it('actualiza el fondo del título al cambiar de sucursal y deja el texto normal', () => {
    render();
    component.branches.set([branch, norte]);
    component.branchId = norte.id;
    render();

    const titleStyle = getComputedStyle(calendarTitle());

    expect(component.selectedBranchColor()).toBe('#2563EB');
    expect(getComputedStyle(calendarPanel()).getPropertyValue('--branch-color').trim()).toBe('#2563EB');
    expect(titleStyle.backgroundColor).toBe(hexToRgb('#2563EB'));
    expect(titleStyle.color).toBe(textColor);
  });
});
