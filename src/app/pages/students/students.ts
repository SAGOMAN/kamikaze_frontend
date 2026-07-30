import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Student } from '../../core/models';

@Component({
  selector: 'app-students',
  imports: [FormsModule],
  templateUrl: './students.html',
})
export class StudentsPage implements OnInit {
  readonly items = signal<Student[]>([]);
  search = '';
  form: Partial<Student> = {
    first_name: '',
    last_name: '',
    nickname: '',
    phone: '',
    email: '',
    is_active: true,
  };
  editingId: number | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.get<Student[]>('/students', { search: this.search }).subscribe((data) => this.items.set(data));
  }

  displayName(s: Student) {
    return s.nickname ? `${s.first_name} ${s.last_name} (“${s.nickname}”)` : `${s.first_name} ${s.last_name}`;
  }

  edit(item: Student) {
    this.editingId = item.id;
    this.form = { ...item };
  }

  reset() {
    this.editingId = null;
    this.form = {
      first_name: '',
      last_name: '',
      nickname: '',
      phone: '',
      email: '',
      is_active: true,
    };
  }

  save() {
    const req = this.editingId
      ? this.api.put<Student>(`/students/${this.editingId}`, this.form)
      : this.api.post<Student>('/students', this.form);

    req.subscribe(() => {
      this.reset();
      this.reload();
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar alumno?')) return;
    this.api.delete(`/students/${id}`).subscribe(() => this.reload());
  }
}
