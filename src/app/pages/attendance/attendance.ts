import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Attendance, Branch, ClassSchedule, PaginatedResponse, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { localDateIso } from '../../shared/date/local-iso-date';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

export type WeekChip = {
  iso: string;
  label: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isSelected: boolean;
  hasAttendance: boolean;
};

export type PickerCell = {
  iso: string;
  day: string;
  empty: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFuture: boolean;
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PICKER_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

@Component({
  selector: 'app-attendance',
  imports: [FormsModule, ListPager, Modal],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css',
})
export class AttendancePage implements OnInit, OnDestroy {
  readonly branches = signal<Branch[]>([]);
  readonly students = signal<Student[]>([]);
  readonly branchSchedules = signal<ClassSchedule[]>([]);
  readonly schedules = signal<ClassSchedule[]>([]);
  readonly attendances = signal<Attendance[]>([]);
  readonly todayAttendances = signal<Attendance[]>([]);
  readonly daysWithAttendance = signal<Set<string>>(new Set());
  readonly studentList = new ListQueryState();
  readonly calendarOpen = signal(false);
  now: () => Date = () => new Date();
  date = this.todayIso();
  branchId: number | null = null;
  scheduleId: number | null = null;
  pickerYear = this.now().getFullYear();
  pickerMonth = this.now().getMonth();

  readonly presentIds = computed(() => new Set(this.attendances().map((a) => a.student_id)));
  readonly presentCount = computed(() => this.attendances().length);
  error = '';

  private scheduleTicker?: ReturnType<typeof setInterval>;

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
    this.scheduleTicker = setInterval(() => {
      if (this.date === this.todayIso()) {
        this.applyDaySchedules();
      }
    }, 30_000);
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

  dateIso(date: Date): string {
    return this.toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  dayOfWeek(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  }

  mondayOfCurrentWeek(): Date {
    const today = this.now();
    const mondayOffset = (today.getDay() + 6) % 7;
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  }

  weekRange(): { from: string; to: string } {
    const monday = this.mondayOfCurrentWeek();
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { from: this.dateIso(monday), to: this.dateIso(sunday) };
  }

  weekChips(): WeekChip[] {
    const monday = this.mondayOfCurrentWeek();
    const today = this.todayIso();
    const marked = this.daysWithAttendance();
    return WEEKDAY_LABELS.map((label, i) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = this.dateIso(date);
      return {
        iso,
        label,
        dayNumber: date.getDate(),
        isToday: iso === today,
        isPast: iso < today,
        isFuture: iso > today,
        isSelected: iso === this.date,
        hasAttendance: marked.has(iso),
      };
    });
  }

  weekTitle(): string {
    const { from, to } = this.weekRange();
    const start = this.parseIso(from);
    const end = this.parseIso(to);
    const startDay = start.getDate();
    const endLabel = end.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
    return `Semana del ${startDay} al ${endLabel}`;
  }

  selectedDateLabel(): string {
    return this.parseIso(this.date).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  isViewingToday(): boolean {
    return this.date === this.todayIso();
  }

  isViewingPast(): boolean {
    return this.date < this.todayIso();
  }

  isViewingFuture(): boolean {
    return this.date > this.todayIso();
  }

  canTakeAttendance(): boolean {
    return this.date <= this.todayIso();
  }

  scheduleFieldLabel(): string {
    if (this.isViewingToday()) return 'Horario en curso';
    return 'Horario';
  }

  emptySchedulesMessage(): string {
    if (this.isViewingToday()) {
      return 'No hay un horario de clase en curso para esta sucursal.';
    }
    if (this.isViewingFuture()) {
      return 'No hay horarios cargados para este día en esta sucursal.';
    }
    return 'No hay horarios para este día en esta sucursal.';
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

  selectChip(isoDate: string) {
    this.selectDate(isoDate);
  }

  selectDate(isoDate: string) {
    if (this.date === isoDate) return;
    this.clearError();
    this.date = isoDate;
    this.applyDaySchedules();
  }

  goToToday() {
    this.selectDate(this.todayIso());
  }

  chipTitle(chip: WeekChip): string {
    if (chip.isFuture) {
      return 'Día futuro: se puede consultar el horario, pero no tomar asistencia';
    }
    if (chip.isPast) {
      return 'Día anterior: puedes corregir o registrar asistencia';
    }
    return 'Día de hoy';
  }

  openCalendar() {
    const [y, m] = this.date.split('-').map(Number);
    this.pickerYear = y;
    this.pickerMonth = m - 1;
    this.calendarOpen.set(true);
  }

  closeCalendar() {
    this.calendarOpen.set(false);
  }

  pickerMonthLabel(): string {
    return new Date(this.pickerYear, this.pickerMonth, 1).toLocaleDateString('es-MX', {
      month: 'long',
      year: 'numeric',
    });
  }

  pickerWeekdays(): string[] {
    return PICKER_WEEKDAYS;
  }

  canAdvancePickerMonth(): boolean {
    const now = this.now();
    return this.pickerYear < now.getFullYear()
      || (this.pickerYear === now.getFullYear() && this.pickerMonth < now.getMonth());
  }

  shiftPickerMonth(delta: number) {
    const next = new Date(this.pickerYear, this.pickerMonth + delta, 1);
    if (delta > 0 && !this.canAdvancePickerMonth()) return;
    this.pickerYear = next.getFullYear();
    this.pickerMonth = next.getMonth();
  }

  pickerCells(): PickerCell[] {
    const first = new Date(this.pickerYear, this.pickerMonth, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(this.pickerYear, this.pickerMonth + 1, 0).getDate();
    const today = this.todayIso();
    const cells: PickerCell[] = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({
        iso: `pad-${i}`,
        day: '',
        empty: true,
        isToday: false,
        isSelected: false,
        isFuture: true,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = this.toIso(this.pickerYear, this.pickerMonth + 1, day);
      cells.push({
        iso,
        day: String(day),
        empty: false,
        isToday: iso === today,
        isSelected: iso === this.date,
        isFuture: iso > today,
      });
    }

    return cells;
  }

  selectCalendarDate(isoDate: string) {
    if (isoDate > this.todayIso()) return;
    this.selectDate(isoDate);
    this.closeCalendar();
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
          this.applyDaySchedules();
        },
        error: (err) => this.setError(err, 'No se pudieron cargar los horarios'),
      });
  }

  applyDaySchedules() {
    const weekday = this.dayOfWeek(this.date);
    let active = this.branchSchedules().filter((s) => s.day_of_week === weekday);
    if (this.isViewingToday()) {
      active = active.filter((s) => this.isScheduleCurrent(s));
    }
    active = [...active].sort(
      (a, b) => this.timeToMinutes(a.start_time) - this.timeToMinutes(b.start_time),
    );
    this.schedules.set(active);
    if (!active.length) {
      this.scheduleId = null;
      this.attendances.set([]);
      this.todayAttendances.set([]);
      this.loadWeekAttendance();
      return;
    }
    const stillValid = active.some((s) => s.id === this.scheduleId);
    this.scheduleId = stillValid ? this.scheduleId : active[0].id;
    this.reload();
  }

  loadWeekAttendance() {
    if (!this.branchId) return;
    const { from, to } = this.weekRange();
    this.api
      .get<Attendance[]>('/attendances', {
        from,
        to,
        branch_id: this.branchId,
      })
      .subscribe({
        next: (data) => {
          this.daysWithAttendance.set(new Set(data.map((a) => this.attendanceDateIso(a))));
        },
        error: (err) => this.setError(err, 'No se pudieron cargar las asistencias de la semana'),
      });
  }

  attendanceDateIso(attendance: Attendance): string {
    return String(attendance.attendance_date).slice(0, 10);
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
          this.loadWeekAttendance();
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
    if (!this.branchId || !this.scheduleId || !this.canTakeAttendance()) return;
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

  private parseIso(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
