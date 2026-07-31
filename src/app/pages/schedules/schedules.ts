import {
  Component,
  OnInit,
  QueryList,
  ViewChildren,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import {
  CalendarOptions,
  DateSelectArg,
  EventClickArg,
  EventInput,
  EventMountArg,
} from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Branch, ClassSchedule, Instructor, PaginatedResponse } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

/** Arg de eventResize (tipos de @fullcalendar/interaction no siempre resuelven en Angular). */
interface ScheduleEventResizeArg {
  event: { id: string; start: Date | null; end: Date | null };
  revert: () => void;
}

export interface BranchCalendarPanel {
  branch: Branch;
  options: CalendarOptions;
}

@Component({
  selector: 'app-schedules',
  imports: [FormsModule, Modal, ListPager, FullCalendarModule],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css',
  encapsulation: ViewEncapsulation.None,
})
export class SchedulesPage implements OnInit {
  @ViewChildren(FullCalendarComponent) calendarComponents?: QueryList<FullCalendarComponent>;

  readonly days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  readonly items = signal<ClassSchedule[]>([]);
  readonly calendarItems = signal<ClassSchedule[]>([]);
  readonly branchPanels = signal<BranchCalendarPanel[]>([]);
  readonly openBranchIds = signal<Set<number>>(new Set());
  readonly instructors = signal<Instructor[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly formOpen = signal(false);
  readonly viewMode = signal<'list' | 'calendar'>('list');
  readonly list = new ListQueryState();

  form: Partial<ClassSchedule> = {
    instructor_id: undefined,
    branch_id: undefined,
    day_of_week: 1,
    start_time: '18:00',
    end_time: '20:00',
    is_active: true,
    notes: '',
  };
  editingId: number | null = null;

  /** Opciones base expuestas para tests de configuración. */
  readonly calendarOptions: CalendarOptions = this.buildCalendarOptions(0, []);

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Instructor[]>('/instructors', { is_active: true }).subscribe((d) => this.instructors.set(d));
    this.api.get<Branch[]>('/branches').subscribe((d) => {
      this.branches.set(d);
      if (this.viewMode() === 'calendar') {
        this.reloadCalendar();
      }
    });
    this.reload();
  }

  setViewMode(mode: 'list' | 'calendar') {
    this.viewMode.set(mode);
    if (mode === 'calendar') {
      setTimeout(() => this.reloadCalendar());
    } else {
      this.reload();
    }
  }

  reload() {
    this.api
      .get<PaginatedResponse<ClassSchedule>>('/class-schedules', this.list.params())
      .subscribe((res) => this.list.apply(res, (data) => this.items.set(data)));
  }

  reloadCalendar() {
    this.api.get<ClassSchedule[]>('/class-schedules').subscribe((data) => {
      this.calendarItems.set(data);
      this.rebuildBranchPanels(data);
    });
  }

  isBranchOpen(branchId: number): boolean {
    return this.openBranchIds().has(branchId);
  }

  toggleBranch(branchId: number) {
    const willOpen = !this.isBranchOpen(branchId);
    this.openBranchIds.update((current) => {
      const next = new Set(current);
      if (willOpen) next.add(branchId);
      else next.delete(branchId);
      return next;
    });
    if (willOpen) {
      // Tras iniciar la animación, recalcular tamaño del calendario.
      setTimeout(() => this.resizeOpenCalendars(), 40);
    }
  }

  onAccordionTransitionEnd(event: TransitionEvent) {
    if (event.propertyName !== 'grid-template-rows') return;
    if (!(event.currentTarget as HTMLElement).closest('.branch-accordion.is-open')) return;
    this.resizeOpenCalendars();
  }

  optionsForBranch(branchId: number): CalendarOptions | undefined {
    return this.branchPanels().find((p) => p.branch.id === branchId)?.options;
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
  }

  goToPage(page: number) {
    this.list.goToPage(page, () => this.reload());
  }

  dayName(day: number) {
    return this.days[day] ?? String(day);
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
  }

  edit(item: ClassSchedule) {
    this.editingId = item.id;
    this.form = {
      ...item,
      start_time: String(item.start_time).slice(0, 5),
      end_time: String(item.end_time).slice(0, 5),
    };
    this.formOpen.set(true);
  }

  closeForm() {
    this.reset();
    this.formOpen.set(false);
  }

  reset() {
    this.editingId = null;
    this.form = {
      instructor_id: undefined,
      branch_id: undefined,
      day_of_week: 1,
      start_time: '18:00',
      end_time: '20:00',
      is_active: true,
      notes: '',
    };
  }

  save() {
    const req = this.editingId
      ? this.api.put(`/class-schedules/${this.editingId}`, this.form)
      : this.api.post('/class-schedules', this.form);
    req.subscribe(() => {
      this.closeForm();
      this.refreshAfterMutation();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este horario?');
    if (!ok) return;
    this.api.delete(`/class-schedules/${id}`).subscribe(() => {
      if (this.editingId === id) this.closeForm();
      this.refreshAfterMutation();
    });
  }

  async removeFromForm() {
    if (!this.editingId) return;
    await this.remove(this.editingId);
  }

  private refreshAfterMutation() {
    if (this.viewMode() === 'calendar') {
      this.reloadCalendar();
    } else {
      this.reload();
    }
  }

  private rebuildBranchPanels(schedules: ClassSchedule[]) {
    const branches = this.branches();
    this.ensureDefaultOpen(branches);
    this.branchPanels.set(
      branches.map((branch) => ({
        branch,
        options: this.buildCalendarOptions(
          branch.id,
          schedules.filter((s) => s.branch_id === branch.id).map((s) => this.toEvent(s)),
        ),
      })),
    );
    setTimeout(() => this.resizeOpenCalendars());
  }

  private ensureDefaultOpen(branches: Branch[]) {
    if (this.openBranchIds().size > 0 || !branches.length) return;
    this.openBranchIds.set(new Set([branches[0].id]));
  }

  private resizeOpenCalendars() {
    this.calendarComponents?.forEach((calendar) => {
      calendar.getApi()?.updateSize();
    });
  }

  private buildCalendarOptions(branchId: number, events: EventInput[]): CalendarOptions {
    return {
      plugins: [timeGridPlugin, interactionPlugin],
      initialView: 'timeGridWeek',
      locale: esLocale,
      height: 'auto',
      firstDay: 1,
      weekends: true,
      allDaySlot: false,
      slotMinTime: '07:00:00',
      slotMaxTime: '21:00:00',
      slotDuration: '01:00:00',
      slotLabelInterval: '01:00:00',
      expandRows: true,
      headerToolbar: false,
      dayHeaderFormat: { weekday: 'long' },
      slotLabelFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      },
      eventTimeFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      },
      selectable: true,
      selectMirror: true,
      selectMinDistance: 0,
      editable: true,
      eventStartEditable: false,
      eventDurationEditable: true,
      eventResizableFromStart: true,
      snapDuration: '01:00:00',
      nowIndicator: false,
      events,
      select: (info) => this.onCalendarSelect(info, branchId),
      eventClick: (info) => this.onEventClick(info),
      eventResize: (info) => this.onEventResize(info as ScheduleEventResizeArg),
      eventDidMount: (info) => this.onEventDidMount(info),
    };
  }

  private onCalendarSelect(info: DateSelectArg, branchId: number) {
    const start = this.formatTime(info.start);
    const end = this.formatTime(info.end);
    if (start >= end) {
      info.view.calendar.unselect();
      return;
    }
    this.editingId = null;
    this.form = {
      instructor_id: undefined,
      branch_id: branchId,
      day_of_week: info.start.getDay(),
      start_time: start,
      end_time: end,
      is_active: true,
      notes: '',
    };
    this.formOpen.set(true);
    info.view.calendar.unselect();
  }

  private onEventClick(info: EventClickArg) {
    const target = info.jsEvent?.target as HTMLElement | null | undefined;
    if (target?.closest('.fc-event-delete')) return;
    const id = Number(info.event.id);
    const item = this.calendarItems().find((s) => s.id === id);
    if (item) this.edit(item);
  }

  private onEventDidMount(info: EventMountArg) {
    if (info.el.querySelector('.fc-event-delete')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fc-event-delete';
    btn.title = 'Eliminar horario';
    btn.setAttribute('aria-label', 'Eliminar horario');
    btn.textContent = '×';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.remove(Number(info.event.id));
    });
    info.el.appendChild(btn);
  }

  private onEventResize(info: ScheduleEventResizeArg) {
    const event = info.event;
    const start = event.start;
    const end = event.end;
    if (!start || !end) {
      info.revert();
      return;
    }
    const startTime = this.formatTime(start);
    const endTime = this.formatTime(end);
    if (startTime >= endTime || start.getDay() !== end.getDay()) {
      info.revert();
      return;
    }

    const id = Number(event.id);
    const item = this.calendarItems().find((s) => s.id === id);
    if (!item) {
      info.revert();
      return;
    }

    this.api
      .put(`/class-schedules/${id}`, {
        instructor_id: item.instructor_id,
        branch_id: item.branch_id,
        day_of_week: start.getDay(),
        start_time: startTime,
        end_time: endTime,
        is_active: item.is_active,
        notes: item.notes ?? '',
      })
      .subscribe({
        next: () => this.patchCalendarItem(id, startTime, endTime, start.getDay()),
        error: () => info.revert(),
      });
  }

  private patchCalendarItem(id: number, startTime: string, endTime: string, dayOfWeek: number) {
    this.calendarItems.update((items) =>
      items.map((s) =>
        s.id === id ? { ...s, start_time: startTime, end_time: endTime, day_of_week: dayOfWeek } : s,
      ),
    );
  }

  private toEvent(schedule: ClassSchedule): EventInput {
    const date = this.templateDateForDay(schedule.day_of_week);
    const start = String(schedule.start_time).slice(0, 5);
    const end = String(schedule.end_time).slice(0, 5);
    const instructor = schedule.instructor?.name || `Profesor #${schedule.instructor_id}`;
    const inactive = schedule.is_active === false ? ' (inactivo)' : '';
    return {
      id: String(schedule.id),
      title: `${instructor}${inactive}`,
      start: `${date}T${start}:00`,
      end: `${date}T${end}:00`,
      classNames: schedule.is_active === false ? ['is-inactive-schedule'] : [],
    };
  }

  private templateDateForDay(dayOfWeek: number): string {
    const monday = this.templateMonday();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return this.toIso(d);
  }

  private templateMonday(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
