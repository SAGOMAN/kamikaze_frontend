import { Component, OnInit, ViewChild, ViewEncapsulation, computed, signal } from '@angular/core';
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
import { ListPager } from '../../shared/list-pager/list-pager';

@Component({
  selector: 'app-attendance',
  imports: [FormsModule, FullCalendarModule, ListPager],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css',
  encapsulation: ViewEncapsulation.None,
})
export class AttendancePage implements OnInit {
  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  readonly branches = signal<Branch[]>([]);
  readonly students = signal<Student[]>([]);
  readonly branchSchedules = signal<ClassSchedule[]>([]);
  readonly schedules = signal<ClassSchedule[]>([]);
  readonly attendances = signal<Attendance[]>([]);
  readonly studentList = new ListQueryState();
  date = this.todayIso();
  branchId: number | null = null;
  scheduleId: number | null = null;

  readonly presentIds = computed(() => new Set(this.attendances().map((a) => a.student_id)));
  readonly presentCount = computed(() => this.attendances().length);

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    initialDate: this.date,
    locale: esLocale,
    height: 'auto',
    fixedWeekCount: false,
    headerToolbar: {
      left: 'prev,next today',
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
    this.api.get<Branch[]>('/branches').subscribe((data) => {
      this.branches.set(data.filter((b) => b.is_active));
      if (data.length && !this.branchId) {
        this.branchId = data[0].id;
        this.loadSchedules();
      }
    });
    this.reloadStudents();
  }

  reloadStudents() {
    this.api
      .get<PaginatedResponse<Student>>(
        '/students',
        this.studentList.params({ is_active: true }),
      )
      .subscribe((res) => this.studentList.apply(res, (data) => this.students.set(data)));
  }

  searchStudents() {
    this.studentList.runSearch(() => this.reloadStudents());
  }

  goToStudentPage(page: number) {
    this.studentList.goToPage(page, () => this.reloadStudents());
  }

  todayIso(): string {
    const now = new Date();
    return this.toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
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

  dayCellClasses(date: Date): string[] {
    const classes: string[] = [];
    const iso = this.toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
    if (iso === this.date) {
      classes.push('is-selected-day');
    }
    if (this.branchSchedules().some((s) => s.day_of_week === date.getDay())) {
      classes.push('has-schedule-day');
    }
    return classes;
  }

  decorateDayCell(arg: DayCellMountArg) {
    const count = this.branchSchedules().filter((s) => s.day_of_week === arg.date.getDay()).length;
    arg.el.querySelector('.fc-day-schedule-dot')?.remove();
    if (!count) return;
    const mark = document.createElement('span');
    mark.className = 'fc-day-schedule-dot';
    mark.title = count === 1 ? '1 horario' : `${count} horarios`;
    mark.setAttribute('aria-hidden', 'true');
    arg.el.querySelector('.fc-daygrid-day-frame')?.appendChild(mark);
  }

  selectDate(isoDate: string) {
    if (this.date === isoDate) return;
    this.date = isoDate;
    this.refreshCalendarDayStyles();
    this.applyDaySchedules();
  }

  onBranchChange() {
    this.loadSchedules();
  }

  loadSchedules() {
    if (!this.branchId) return;
    this.api
      .get<ClassSchedule[]>('/class-schedules', {
        branch_id: this.branchId,
      })
      .subscribe((data) => {
        this.branchSchedules.set(data.filter((s) => s.is_active));
        this.refreshCalendarDayStyles();
        this.applyDaySchedules();
      });
  }

  applyDaySchedules() {
    const active = this.branchSchedules().filter((s) => s.day_of_week === this.dayOfWeek(this.date));
    this.schedules.set(active);
    if (!active.length) {
      this.scheduleId = null;
      this.attendances.set([]);
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
    if (!this.branchId || !this.scheduleId) {
      this.attendances.set([]);
      return;
    }
    this.api
      .get<Attendance[]>('/attendances', {
        date: this.date,
        branch_id: this.branchId,
        class_schedule_id: this.scheduleId,
      })
      .subscribe((data) => this.attendances.set(data));
  }

  label(s: Student) {
    return s.nickname ? `${s.first_name} ${s.last_name} (${s.nickname})` : `${s.first_name} ${s.last_name}`;
  }

  isPresent(studentId: number) {
    return this.presentIds().has(studentId);
  }

  async toggle(student: Student) {
    if (!this.branchId || !this.scheduleId) return;

    const existing = this.attendances().find((a) => a.student_id === student.id);
    if (existing) {
      const ok = await this.confirm.ask(
        `¿Está seguro de que desea quitar la asistencia de ${this.label(student)}?`,
      );
      if (!ok) return;
      this.api.delete(`/attendances/${existing.id}`).subscribe(() => this.reload());
      return;
    }

    this.api
      .post('/attendances', {
        student_id: student.id,
        branch_id: this.branchId,
        class_schedule_id: this.scheduleId,
        attendance_date: this.date,
      })
      .subscribe(() => this.reload());
  }
}
