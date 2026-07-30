import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, ClassSchedule, Instructor } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-schedules',
  imports: [FormsModule, Modal],
  templateUrl: './schedules.html',
})
export class SchedulesPage implements OnInit {
  readonly days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  readonly items = signal<ClassSchedule[]>([]);
  readonly instructors = signal<Instructor[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly formOpen = signal(false);
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

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Instructor[]>('/instructors', { is_active: true }).subscribe((d) => this.instructors.set(d));
    this.api.get<Branch[]>('/branches').subscribe((d) => this.branches.set(d));
    this.reload();
  }

  reload() {
    this.api.get<ClassSchedule[]>('/class-schedules').subscribe((data) => this.items.set(data));
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
      this.reload();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este horario?');
    if (!ok) return;
    this.api.delete(`/class-schedules/${id}`).subscribe(() => this.reload());
  }
}
