import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Instructor } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-instructors',
  imports: [FormsModule, Modal],
  templateUrl: './instructors.html',
})
export class InstructorsPage implements OnInit {
  readonly items = signal<Instructor[]>([]);
  readonly formOpen = signal(false);
  form: Partial<Instructor> = { name: '', phone: '', email: '', is_active: true, notes: '' };
  editingId: number | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.get<Instructor[]>('/instructors').subscribe((data) => this.items.set(data));
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
  }

  edit(item: Instructor) {
    this.editingId = item.id;
    this.form = { ...item };
    this.formOpen.set(true);
  }

  closeForm() {
    this.reset();
    this.formOpen.set(false);
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
      this.closeForm();
      this.reload();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este profesor?');
    if (!ok) return;
    this.api.delete(`/instructors/${id}`).subscribe(() => this.reload());
  }
}
