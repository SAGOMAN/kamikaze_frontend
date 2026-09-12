import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
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
import { forkJoin, Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Branch, ClassSchedule, Instructor, PaginatedResponse } from '../../core/models';
import { ActionBtn } from '../../shared/action-btn/action-btn';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { isNavCompact } from '../../shared/layout/breakpoints';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
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

interface InstructorDragSlot {
  branchId: number;
  start: Date;
}

@Component({
  selector: 'app-schedules',
  imports: [FormsModule, Modal, ListPager, FullCalendarModule, FieldError, ActionBtn],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css',
  encapsulation: ViewEncapsulation.None,
})
export class SchedulesPage implements OnInit, OnDestroy {
  @ViewChildren(FullCalendarComponent) calendarComponents?: QueryList<FullCalendarComponent>;
  @ViewChild('paletteSlot') paletteSlot?: ElementRef<HTMLElement>;
  @ViewChild('palettePanel') palettePanel?: ElementRef<HTMLElement>;

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
  readonly dragInstructor = signal<Instructor | null>(null);
  readonly dragOverBranchId = signal<number | null>(null);
  readonly ghostX = signal(0);
  readonly ghostY = signal(0);
  readonly calendarError = signal('');
  formError = '';
  apiErrors: Record<string, string> = {};
  readonly showInvalid = showInvalid;

  private dragRangeStart: InstructorDragSlot | null = null;
  private dragRangeEnd: Date | null = null;
  private suppressSelect = false;
  private assigning = false;
  private unbindDragListeners: (() => void) | null = null;
  private unbindPaletteFixed: (() => void) | null = null;
  private compactCalendar = false;
  private readonly onPaletteScroll = () => this.syncPaletteFixed();
  private readonly onViewportResize = () => {
    this.syncPaletteFixed();
    this.syncCalendarCompact();
  };

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
    this.compactCalendar = this.isCompactCalendar();
  }

  ngOnDestroy() {
    this.clearInstructorDrag();
    this.stopPaletteFixed();
  }

  setViewMode(mode: 'list' | 'calendar') {
    this.viewMode.set(mode);
    if (mode === 'calendar') {
      setTimeout(() => {
        this.reloadCalendar();
        this.startPaletteFixed();
      });
    } else {
      this.stopPaletteFixed();
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
    this.formError = '';
    this.apiErrors = {};
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
    this.formError = '';
    this.apiErrors = {};
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

  save(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
    const req = this.editingId
      ? this.api.put(`/class-schedules/${this.editingId}`, this.form)
      : this.api.post('/class-schedules', this.form);
    req.subscribe({
      next: () => {
        this.closeForm();
        this.refreshAfterMutation();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el horario');
        this.formError = parsed.message;
        this.apiErrors = parsed.fieldErrors;
      },
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

  private startPaletteFixed() {
    this.stopPaletteFixed();
    const content = document.querySelector('.content');
    content?.addEventListener('scroll', this.onPaletteScroll, { passive: true });
    window.addEventListener('scroll', this.onPaletteScroll, { passive: true });
    window.addEventListener('resize', this.onViewportResize);
    this.unbindPaletteFixed = () => {
      content?.removeEventListener('scroll', this.onPaletteScroll);
      window.removeEventListener('scroll', this.onPaletteScroll);
      window.removeEventListener('resize', this.onViewportResize);
      this.unbindPaletteFixed = null;
    };
    requestAnimationFrame(() => {
      this.syncPaletteFixed();
      this.syncCalendarCompact();
    });
  }

  private stopPaletteFixed() {
    this.unbindPaletteFixed?.();
    const panel = this.palettePanel?.nativeElement;
    if (panel) {
      panel.style.position = '';
      panel.style.left = '';
      panel.style.top = '';
      panel.style.width = '';
      panel.style.maxHeight = '';
    }
    const slot = this.paletteSlot?.nativeElement;
    if (slot) slot.style.minHeight = '';
  }

  private syncPaletteFixed() {
    const slot = this.paletteSlot?.nativeElement;
    const panel = this.palettePanel?.nativeElement;
    if (!slot || !panel || this.viewMode() !== 'calendar') return;
    const rect = slot.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.top = `${Math.max(16, rect.top)}px`;
    panel.style.maxHeight = `${Math.max(120, window.innerHeight - 32)}px`;
    if (isNavCompact()) {
      slot.style.minHeight = `${panel.offsetHeight}px`;
    } else {
      slot.style.minHeight = '';
    }
  }

  onInstructorPointerDown(event: PointerEvent, instructor: Instructor) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.assigning) return;
    event.preventDefault();
    this.calendarError.set('');
    this.dragInstructor.set(instructor);
    this.ghostX.set(event.clientX);
    this.ghostY.set(event.clientY);
    this.dragRangeStart = null;
    this.dragRangeEnd = null;
    this.dragOverBranchId.set(null);
    document.body.classList.add('is-dragging-instructor');
    this.bindDragListeners();
  }

  overlappingSchedules(
    branchId: number,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
  ): ClassSchedule[] {
    const start = this.toHm(startTime);
    const end = this.toHm(endTime);
    return this.calendarItems().filter((schedule) => {
      if (schedule.branch_id !== branchId || schedule.day_of_week !== dayOfWeek) return false;
      return this.toHm(schedule.start_time) < end && this.toHm(schedule.end_time) > start;
    });
  }

  hourlySlots(rangeStart: Date, rangeEnd: Date): { start: Date; end: Date }[] {
    const slots: { start: Date; end: Date }[] = [];
    if (rangeStart.getDay() !== rangeEnd.getDay()) return slots;
    const hourMs = 60 * 60 * 1000;
    let cursor = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    while (cursor + hourMs <= endMs) {
      slots.push({ start: new Date(cursor), end: new Date(cursor + hourMs) });
      cursor += hourMs;
    }
    return slots;
  }

  assignInstructorToRange(branchId: number, rangeStart: Date, rangeEnd: Date, instructor: Instructor) {
    const slots = this.hourlySlots(rangeStart, rangeEnd);
    if (!slots.length) return;

    const dayOfWeek = rangeStart.getDay();
    const requests: Observable<unknown>[] = [];
    const updatedIds = new Set<number>();

    for (const slot of slots) {
      const startTime = this.formatTime(slot.start);
      const endTime = this.formatTime(slot.end);
      const overlapping = this.overlappingSchedules(branchId, dayOfWeek, startTime, endTime);
      if (overlapping.length) {
        for (const schedule of overlapping) {
          if (schedule.instructor_id === instructor.id || updatedIds.has(schedule.id)) continue;
          updatedIds.add(schedule.id);
          requests.push(this.api.put(`/class-schedules/${schedule.id}`, { instructor_id: instructor.id }));
        }
        continue;
      }

      requests.push(
        this.api.post('/class-schedules', {
          instructor_id: instructor.id,
          branch_id: branchId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          is_active: true,
          notes: '',
        }),
      );
    }

    if (!requests.length) return;

    this.assigning = true;
    forkJoin(requests).subscribe({
      next: () => {
        this.assigning = false;
        this.reloadCalendar();
      },
      error: (err) => {
        this.assigning = false;
        this.calendarError.set(parseApiError(err, 'No se pudieron guardar los horarios').message);
        this.reloadCalendar();
      },
    });
  }

  private bindDragListeners() {
    this.unbindDragListeners?.();
    const move = (event: PointerEvent) => this.onDragPointerMove(event);
    const up = (event: PointerEvent) => this.onDragPointerUp(event);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.unbindDragListeners = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.unbindDragListeners = null;
    };
  }

  private onDragPointerMove(event: PointerEvent) {
    if (!this.dragInstructor()) return;
    if (event.cancelable) event.preventDefault();
    this.ghostX.set(event.clientX);
    this.ghostY.set(event.clientY);
    const slot = this.slotFromPoint(event.clientX, event.clientY);
    if (!slot) {
      this.dragOverBranchId.set(null);
      return;
    }
    this.dragOverBranchId.set(slot.branchId);
    if (
      !this.dragRangeStart ||
      this.dragRangeStart.branchId !== slot.branchId ||
      this.toIso(this.dragRangeStart.start) !== this.toIso(slot.start)
    ) {
      this.unselectDragCalendar();
      this.dragRangeStart = { branchId: slot.branchId, start: slot.start };
    }
    this.dragRangeEnd = slot.start;
    this.highlightDragRange();
  }

  private onDragPointerUp(event: PointerEvent) {
    const instructor = this.dragInstructor();
    const startSlot = this.dragRangeStart;
    const endSlot = this.dragRangeEnd;
    const dropSlot = this.slotFromPoint(event.clientX, event.clientY);
    this.clearInstructorDrag();
    if (!instructor || !startSlot || !endSlot || !dropSlot) return;
    if (dropSlot.branchId !== startSlot.branchId) return;

    const rangeStart = startSlot.start <= endSlot ? startSlot.start : endSlot;
    const last = startSlot.start <= endSlot ? endSlot : startSlot.start;
    const rangeEnd = new Date(last.getTime() + 60 * 60 * 1000);
    this.assignInstructorToRange(startSlot.branchId, rangeStart, rangeEnd, instructor);
  }

  private highlightDragRange() {
    if (!this.dragRangeStart || !this.dragRangeEnd) return;
    const start =
      this.dragRangeStart.start <= this.dragRangeEnd ? this.dragRangeStart.start : this.dragRangeEnd;
    const last =
      this.dragRangeStart.start <= this.dragRangeEnd ? this.dragRangeEnd : this.dragRangeStart.start;
    const end = new Date(last.getTime() + 60 * 60 * 1000);
    const api = this.calendarApiForBranch(this.dragRangeStart.branchId);
    if (!api) return;
    this.suppressSelect = true;
    api.select(start, end);
    this.suppressSelect = false;
  }

  private unselectDragCalendar() {
    if (!this.dragRangeStart) return;
    this.suppressSelect = true;
    this.calendarApiForBranch(this.dragRangeStart.branchId)?.unselect();
    this.suppressSelect = false;
  }

  private clearInstructorDrag() {
    this.unbindDragListeners?.();
    this.unselectDragCalendar();
    this.dragInstructor.set(null);
    this.dragOverBranchId.set(null);
    this.dragRangeStart = null;
    this.dragRangeEnd = null;
    document.body.classList.remove('is-dragging-instructor');
  }

  private calendarApiForBranch(branchId: number) {
    const index = this.branchPanels().findIndex((panel) => panel.branch.id === branchId);
    if (index < 0) return undefined;
    return this.calendarComponents?.get(index)?.getApi();
  }

  private calendarElementFromPoint(clientX: number, clientY: number): HTMLElement | null {
    const hits = document.elementsFromPoint(clientX, clientY);
    for (const node of hits) {
      const calendar = (node as Element).closest?.('.schedules-calendar[data-branch-id]') as HTMLElement | null;
      if (!calendar) continue;
      if (!calendar.closest('.branch-accordion.is-open')) continue;
      if (!this.pointInVisibleCalendar(calendar, clientX, clientY)) continue;
      return calendar;
    }
    return null;
  }

  private pointInVisibleCalendar(calendarEl: HTMLElement, clientX: number, clientY: number): boolean {
    const clipParent = calendarEl.closest('.branch-accordion-body-inner') as HTMLElement | null;
    const clip = (clipParent ?? calendarEl).getBoundingClientRect();
    if (clip.height < 8 || clip.width < 8) return false;
    return clientX >= clip.left && clientX < clip.right && clientY >= clip.top && clientY < clip.bottom;
  }

  slotFromPoint(clientX: number, clientY: number): InstructorDragSlot | null {
    const calendarEl = this.calendarElementFromPoint(clientX, clientY);
    if (!calendarEl) return null;

    const branchId = Number(calendarEl.dataset['branchId']);
    if (!Number.isFinite(branchId)) return null;

    let dateStr: string | null = null;
    const cols = calendarEl.querySelectorAll<HTMLElement>('.fc-timegrid-cols .fc-timegrid-col[data-date]');
    for (const col of Array.from(cols)) {
      const colRect = col.getBoundingClientRect();
      if (clientX >= colRect.left && clientX < colRect.right) {
        dateStr = col.getAttribute('data-date');
        break;
      }
    }

    let timeStr: string | null = null;
    const lanes = calendarEl.querySelectorAll<HTMLElement>(
      '.fc-timegrid-slot-lane[data-time]:not(.fc-timegrid-slot-minor)',
    );
    for (const lane of Array.from(lanes)) {
      const laneRect = lane.getBoundingClientRect();
      if (clientY >= laneRect.top && clientY < laneRect.bottom) {
        timeStr = lane.getAttribute('data-time');
        break;
      }
    }

    if (!dateStr || !timeStr) return null;
    const start = this.dateFromIsoAndTime(dateStr, timeStr);
    if (!start) return null;
    return { branchId, start };
  }

  private dateFromIsoAndTime(dateStr: string, timeStr: string): Date | null {
    const dateParts = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':').map(Number);
    if (dateParts.length < 3 || timeParts.length < 2) return null;
    const [year, month, day] = dateParts;
    const [hour, minute] = timeParts;
    if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  private toHm(value: string): string {
    return String(value).slice(0, 5);
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

  private isCompactCalendar(): boolean {
    return isNavCompact();
  }

  private syncCalendarCompact() {
    if (this.viewMode() !== 'calendar') return;
    const compact = this.isCompactCalendar();
    if (compact === this.compactCalendar) {
      this.resizeOpenCalendars();
      return;
    }
    this.compactCalendar = compact;
    this.rebuildBranchPanels(this.calendarItems());
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
      dayHeaderFormat: this.isCompactCalendar() ? { weekday: 'short' } : { weekday: 'long' },
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
    if (this.suppressSelect || this.dragInstructor()) {
      return;
    }
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
    const event: EventInput = {
      id: String(schedule.id),
      title: `${instructor}${inactive}`,
      start: `${date}T${start}:00`,
      end: `${date}T${end}:00`,
      classNames: schedule.is_active === false ? ['is-inactive-schedule'] : [],
    };

    if (schedule.is_active !== false) {
      const color = schedule.instructor?.color || '#64748B';
      event.backgroundColor = color;
      event.borderColor = color;
      event.textColor = this.contrastText(color);
    }

    return event;
  }

  contrastText(hex: string): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) {
      return '#FFFFFF';
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#1A1A1A' : '#FFFFFF';
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
