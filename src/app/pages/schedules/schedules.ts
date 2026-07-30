import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch, ClassSchedule, Instructor } from '../../core/models';

@Component({
  selector: 'app-schedules',
  imports: [FormsModule],
  templateUrl: './schedules.html',
})
export class SchedulesPage implements OnInit {
  readonly days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  readonly items = signal<ClassSchedule[]>([]);
  readonly instructors = signal<Instructor[]>([]);
  readonly branches = signal<Branch[]>([]);
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

  constructor(private readonly api: ApiService) {}

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

  edit(item: ClassSchedule) {
    this.editingId = item.id;
    this.form = {
      ...item,
      start_time: String(item.start_time).slice(0, 5),
      end_time: String(item.end_time).slice(0, 5),
    };
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
      this.reset();
      this.reload();
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar horario?')) return;
    this.api.delete(`/class-schedules/${id}`).subscribe(() => this.reload());
  }
}
