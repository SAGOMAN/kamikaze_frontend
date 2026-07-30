import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Instructor } from '../../core/models';

@Component({
  selector: 'app-instructors',
  imports: [FormsModule],
  templateUrl: './instructors.html',
})
export class InstructorsPage implements OnInit {
  readonly items = signal<Instructor[]>([]);
  form: Partial<Instructor> = { name: '', phone: '', email: '', is_active: true, notes: '' };
  editingId: number | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.get<Instructor[]>('/instructors').subscribe((data) => this.items.set(data));
  }

  edit(item: Instructor) {
    this.editingId = item.id;
    this.form = { ...item };
  }

  reset() {
    this.editingId = null;
    this.form = { name: '', phone: '', email: '', is_active: true, notes: '' };
  }

  save() {
    const req = this.editingId
      ? this.api.put(`/instructors/${this.editingId}`, this.form)
      : this.api.post('/instructors', this.form);
    req.subscribe(() => {
      this.reset();
      this.reload();
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar profesor?')) return;
    this.api.delete(`/instructors/${id}`).subscribe(() => this.reload());
  }
}
