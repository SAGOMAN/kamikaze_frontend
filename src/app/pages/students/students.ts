import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { PaginatedResponse, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-students',
  imports: [FormsModule, Modal, ListPager, FieldError],
  templateUrl: './students.html',
})
export class StudentsPage implements OnInit {
  readonly items = signal<Student[]>([]);
  readonly formOpen = signal(false);
  readonly list = new ListQueryState();
  form: Partial<Student> = {
    first_name: '',
    last_name: '',
    nickname: '',
    phone: '',
    email: '',
    is_active: true,
  };
  editingId: number | null = null;
  formError = '';
  apiErrors: Record<string, string> = {};
  readonly showInvalid = showInvalid;

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api
      .get<PaginatedResponse<Student>>('/students', this.list.params())
      .subscribe((res) => this.list.apply(res, (data) => this.items.set(data)));
  }

  searchNow() {
    this.list.runSearch(() => this.reload());
  }

  goToPage(page: number) {
    this.list.goToPage(page, () => this.reload());
  }

  displayName(s: Student) {
    return s.nickname ? `${s.first_name} ${s.last_name} (“${s.nickname}”)` : `${s.first_name} ${s.last_name}`;
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
  }

  edit(item: Student) {
    this.editingId = item.id;
    this.form = { ...item };
    this.formError = '';
    this.apiErrors = {};
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
      first_name: '',
      last_name: '',
      nickname: '',
      phone: '',
      email: '',
      is_active: true,
    };
  }

  save(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
    const req = this.editingId
      ? this.api.put<Student>(`/students/${this.editingId}`, this.form)
      : this.api.post<Student>('/students', this.form);

    req.subscribe({
      next: () => {
        this.closeForm();
        this.reload();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar el alumno');
        this.formError = parsed.message;
        this.apiErrors = parsed.fieldErrors;
      },
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar este alumno?');
    if (!ok) return;
    this.api.delete(`/students/${id}`).subscribe(() => this.reload());
  }
}
