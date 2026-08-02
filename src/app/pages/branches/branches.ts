import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { Branch, PaginatedResponse } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';

const DEFAULT_COLOR = '#64748B';

@Component({
  selector: 'app-branches',
  imports: [FormsModule, Modal, ListPager, FieldError],
  templateUrl: './branches.html',
})
export class BranchesPage implements OnInit {
  readonly items = signal<Branch[]>([]);
  readonly formOpen = signal(false);
  readonly list = new ListQueryState();
  form: Partial<Branch> = { name: '', address: '', is_active: true, color: DEFAULT_COLOR };
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
      .get<PaginatedResponse<Branch>>('/branches', this.list.params())
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

  edit(item: Branch) {
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
    this.form = { name: '', address: '', is_active: true, color: DEFAULT_COLOR };
  }

  onColorPicker(value: string) {
    this.form.color = value.toUpperCase();
  }

  save(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
    const payload = {
      ...this.form,
      color: (this.form.color || DEFAULT_COLOR).toUpperCase(),
    };
    const req = this.editingId
      ? this.api.put(`/branches/${this.editingId}`, payload)
      : this.api.post('/branches', payload);
    req.subscribe({
      next: () => {
        this.closeForm();
        this.reload();
      },
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo guardar la sucursal');
        this.formError = parsed.message;
        this.apiErrors = parsed.fieldErrors;
      },
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar esta sucursal?');
    if (!ok) return;
    this.api.delete(`/branches/${id}`).subscribe(() => this.reload());
  }
}
