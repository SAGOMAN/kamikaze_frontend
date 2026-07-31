import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Instructor, PaginatedResponse } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

const DEFAULT_COLOR = '#64748B';

@Component({
  selector: 'app-instructors',
  imports: [FormsModule, Modal, ListPager],
  templateUrl: './instructors.html',
})
export class InstructorsPage implements OnInit {
  readonly items = signal<Instructor[]>([]);
  readonly formOpen = signal(false);
  readonly list = new ListQueryState();
  form: Partial<Instructor> = {
    name: '',
    phone: '',
    email: '',
    is_active: true,
    color: DEFAULT_COLOR,
    notes: '',
  };
  editingId: number | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api
      .get<PaginatedResponse<Instructor>>('/instructors', this.list.params())
      .subscribe((res) => this.list.apply(res, (data) => this.items.set(data)));
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
  }

  goToPage(page: number) {
    this.list.goToPage(page, () => this.reload());
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
    this.form = {
      name: '',
      phone: '',
      email: '',
      is_active: true,
      color: DEFAULT_COLOR,
      notes: '',
    };
  }

  onColorPicker(value: string) {
    this.form.color = value.toUpperCase();
  }

  save() {
    const payload = {
      ...this.form,
      color: (this.form.color || DEFAULT_COLOR).toUpperCase(),
    };
    const req = this.editingId
      ? this.api.put(`/instructors/${this.editingId}`, payload)
      : this.api.post('/instructors', payload);
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
