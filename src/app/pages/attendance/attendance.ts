import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DayCellMountArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Attendance, Branch, ClassSchedule, PaginatedResponse, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { localDateIso } from '../../shared/date/local-iso-date';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { ListPager } from '../../shared/list-pager/list-pager';

@Component({
  selector: 'app-attendance',
  imports: [FormsModule, FullCalendarModule, ListPager],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css',
  encapsulation: ViewEncapsulation.None,
})
export class AttendancePage implements OnInit, OnDestroy {
  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  readonly branches = signal<Branch[]>([]);
  readonly students = signal<Student[]>([]);
  readonly branchSchedules = signal<ClassSchedule[]>([]);
  readonly schedules = signal<ClassSchedule[]>([]);
  readonly attendances = signal<Attendance[]>([]);
  readonly todayAttendances = signal<Attendance[]>([]);
  readonly studentList = new ListQueryState();
  now: () => Date = () => new Date();
  date = this.todayIso();
  branchId: number | null = null;
  scheduleId: number | null = null;

  readonly presentIds = computed(() => new Set(this.attendances().map((a) => a.student_id)));
  readonly presentCount = computed(() => this.attendances().length);
  error = '';

  private scheduleTicker?: ReturnType<typeof setInterval>;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    initialDate: this.date,
    locale: esLocale,
    height: 'auto',
    fixedWeekCount: false,
    headerToolbar: {
      left: '',
      center: 'title',
      right: '',
    },
    buttonText: {
      today: 'Hoy',
    },
    selectable: false,
    dateClick: (info) => this.selectDate(info.dateStr),
    dayCellClassNames: (arg) => this.dayCellClasses(arg.date),
    dayCellDidMount: (arg) => this.decorateDayCell(arg),
  };

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.date = this.todayIso();
    this.api.get<Branch[]>('/branches').subscribe({
      next: (data) => {
        this.branches.set(data.filter((b) => b.is_active));
        if (data.length && !this.branchId) {
          this.branchId = data[0].id;
          this.loadSchedules();
        }
      },
      error: (err) => this.setError(err, 'No se pudieron cargar las sucursales'),
    });
    this.reloadStudents();
    this.scheduleTicker = setInterval(() => this.applyDaySchedules(), 30_000);
  }

  ngOnDestroy() {
    if (this.scheduleTicker) {
      clearInterval(this.scheduleTicker);
    }
  }

  reloadStudents() {
    this.api
      .get<PaginatedResponse<Student>>(
        '/students',
        this.studentList.params({ is_active: true }),
      )
      .subscribe({
        next: (res) => this.studentList.apply(res, (data) => this.students.set(data)),
        error: (err) => this.setError(err, 'No se pudieron cargar los alumnos'),
      });
  }

  searchStudents() {
    this.studentList.runSearch(() => this.reloadStudents());
  }

  goToStudentPage(page: number) {
    this.studentList.goToPage(page, () => this.reloadStudents());
  }

  todayIso(): string {
    return localDateIso(this.now());
  }

  toIso(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  dayOfWeek(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  }

  selectedDateLabel(): string {
    const [y, m, d] = this.date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  scheduleLabel(s: ClassSchedule): string {
    const start = (s.start_time ?? '').slice(0, 5);
    const end = (s.end_time ?? '').slice(0, 5);
    const instructor = s.instructor?.name || 'Sin instructor';
    return `${start}–${end} · ${instructor}`;
  }

  timeToMinutes(time: string): number {
    const [hours, minutes] = (time || '00:00').slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  }

  isScheduleCurrent(schedule: ClassSchedule, at: Date = this.now()): boolean {
    if (schedule.day_of_week !== at.getDay()) {
      return false;
    }
    const current = at.getHours() * 60 + at.getMinutes();
    const start = this.timeToMinutes(schedule.start_time);
    const end = this.timeToMinutes(schedule.end_time);
    return current >= start && current < end;
  }

  schedulesOverlap(a: ClassSchedule, b: ClassSchedule): boolean {
    return this.timeToMinutes(a.start_time) < this.timeToMinutes(b.end_time)
      && this.timeToMinutes(b.start_time) < this.timeToMinutes(a.end_time);
  }

  currentSchedule(): ClassSchedule | undefined {
    return this.schedules().find((s) => s.id === this.scheduleId);
  }

  elsewhereAttendance(studentId: number): Attendance | undefined {
    const current = this.currentSchedule();
    if (!current) return undefined;
    return this.todayAttendances().find((a) => {
      if (a.student_id !== studentId || a.class_schedule_id === this.scheduleId) {
        return false;
      }
      const other = a.class_schedule;
      return !!other && this.schedulesOverlap(current, other);
    });
  }

  dayCellClasses(date: Date): string[] {
    const classes: string[] = [];
    const iso = this.toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
    if (iso === this.date) {
      classes.push('is-selected-day');
    }
    if (iso !== this.todayIso()) {
      classes.push('is-unavailable-day');
    }
    if (this.branchSchedules().some((s) => s.day_of_week === date.getDay())) {
      classes.push('has-schedule-day');
    }
    return classes;
  }

  decorateDayCell(arg: DayCellMountArg) {
    const iso = this.toIso(arg.date.getFullYear(), arg.date.getMonth() + 1, arg.date.getDate());
    arg.el.querySelector('.fc-day-schedule-dot')?.remove();
    if (iso !== this.todayIso()) {
      arg.el.setAttribute('aria-disabled', 'true');
      return;
    }
    arg.el.removeAttribute('aria-disabled');
    const count = this.branchSchedules().filter((s) => s.day_of_week === arg.date.getDay()).length;
    if (!count) return;
    const mark = document.createElement('span');
    mark.className = 'fc-day-schedule-dot';
    mark.title = count === 1 ? '1 horario' : `${count} horarios`;
    mark.setAttribute('aria-hidden', 'true');
    arg.el.querySelector('.fc-daygrid-day-frame')?.appendChild(mark);
  }

  selectDate(isoDate: string) {
    if (isoDate !== this.todayIso()) return;
    if (this.date === isoDate) return;
    this.clearError();
    this.date = isoDate;
    this.refreshCalendarDayStyles();
    this.applyDaySchedules();
  }

  selectedBranch(): Branch | undefined {
    return this.branches().find((b) => b.id === this.branchId);
  }

  selectedBranchColor(): string {
    return this.selectedBranch()?.color || '#64748B';
  }

  onBranchChange() {
    this.clearError();
    this.loadSchedules();
  }

  loadSchedules() {
    if (!this.branchId) return;
    this.api
      .get<ClassSchedule[]>('/class-schedules', {
        branch_id: this.branchId,
      })
      .subscribe({
        next: (data) => {
          this.branchSchedules.set(data.filter((s) => s.is_active));
          this.refreshCalendarDayStyles();
          this.applyDaySchedules();
        },
        error: (err) => this.setError(err, 'No se pudieron cargar los horarios'),
      });
  }

  applyDaySchedules() {
    this.date = this.todayIso();
    const active = this.branchSchedules().filter((s) => this.isScheduleCurrent(s));
    this.schedules.set(active);
    if (!active.length) {
      this.scheduleId = null;
      this.attendances.set([]);
      this.todayAttendances.set([]);
      return;
    }
    const stillValid = active.some((s) => s.id === this.scheduleId);
    this.scheduleId = stillValid ? this.scheduleId : active[0].id;
    this.reload();
  }

  refreshCalendarDayStyles() {
    const api = this.calendarComponent?.getApi();
    if (!api) return;
    api.gotoDate(this.date);
    api.render();
  }

  reload() {
    this.clearError();
    if (!this.branchId || !this.scheduleId) {
      this.attendances.set([]);
      this.todayAttendances.set([]);
      return;
    }
    this.api
      .get<Attendance[]>('/attendances', {
        date: this.date,
      })
      .subscribe({
        next: (data) => {
          this.todayAttendances.set(data);
          this.attendances.set(data.filter((a) => a.class_schedule_id === this.scheduleId));
        },
        error: (err) => this.setError(err, 'No se pudieron cargar las asistencias'),
      });
  }

  label(s: Student) {
    return s.nickname ? `${s.first_name} ${s.last_name} (${s.nickname})` : `${s.first_name} ${s.last_name}`;
  }

  isPresent(studentId: number) {
    return this.presentIds().has(studentId);
  }

  clearError() {
    this.error = '';
  }

  setError(err: unknown, fallback: string) {
    this.error = parseApiError(err, fallback).message;
  }

  async toggle(student: Student) {
    if (!this.branchId || !this.scheduleId) return;
    if (!this.isPresent(student.id) && this.elsewhereAttendance(student.id)) return;

    const existing = this.attendances().find((a) => a.student_id === student.id);
    if (existing) {
      const ok = await this.confirm.ask(
        `¿Está seguro de que desea quitar la asistencia de ${this.label(student)}?`,
      );
      if (!ok) return;
      this.clearError();
      this.api.delete(`/attendances/${existing.id}`).subscribe({
        next: () => this.reload(),
        error: (err) => this.setError(err, 'No se pudo quitar la asistencia'),
      });
      return;
    }

    this.clearError();
    this.api
      .post('/attendances', {
        student_id: student.id,
        branch_id: this.branchId,
        class_schedule_id: this.scheduleId,
        attendance_date: this.date,
      })
      .subscribe({
        next: () => this.reload(),
        error: (err) => this.setError(err, 'No se pudo marcar la asistencia'),
      });
  }
}
