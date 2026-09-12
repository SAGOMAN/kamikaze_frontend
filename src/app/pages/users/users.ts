import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { ListQueryState } from '../../core/list-query';
import { PaginatedResponse, PlatformUser, UserRole } from '../../core/models';
import { ActionBtn } from '../../shared/action-btn/action-btn';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';
import { ListPager } from '../../shared/list-pager/list-pager';
import { Modal } from '../../shared/modal/modal';
import { PasswordInput } from '../../shared/password-input/password-input';

interface UserForm {
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  password: string;
  password_confirmation: string;
}

@Component({
  selector: 'app-users',
  imports: [FormsModule, Modal, ListPager, FieldError, PasswordInput, ActionBtn],
  templateUrl: './users.html',
})
export class UsersPage implements OnInit {
  readonly items = signal<PlatformUser[]>([]);
  readonly formOpen = signal(false);
  readonly passwordOpen = signal(false);
  readonly list = new ListQueryState();
  form: UserForm = this.emptyForm();
  passwordForm = { password: '', password_confirmation: '' };
  editingId: number | null = null;
  passwordUserId: number | null = null;
  formError = '';
  passwordError = '';
  apiErrors: Record<string, string> = {};
  passwordApiErrors: Record<string, string> = {};
  readonly showInvalid = showInvalid;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api
      .get<PaginatedResponse<PlatformUser>>('/users', this.list.params())
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

  edit(item: PlatformUser) {
    this.editingId = item.id;
    this.form = {
      name: item.name,
      email: item.email,
      role: item.role,
      is_active: item.is_active,
      password: '',
      password_confirmation: '',
    };
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
    this.form = this.emptyForm();
  }

  save(f: NgForm) {
    this.formError = '';
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }

    if (!this.editingId) {
      this.api
        .post('/users', {
          name: this.form.name,
          email: this.form.email,
          role: this.form.role,
          is_active: this.form.is_active,
          password: this.form.password,
          password_confirmation: this.form.password_confirmation,
        })
        .subscribe({
          next: () => {
            this.closeForm();
            this.reload();
          },
          error: (err) => {
            const parsed = parseApiError(err, 'No se pudo crear el usuario');
            this.formError = parsed.message;
            this.apiErrors = parsed.fieldErrors;
          },
        });
      return;
    }

    this.api
      .put(`/users/${this.editingId}`, {
        name: this.form.name,
        email: this.form.email,
        role: this.form.role,
        is_active: this.form.is_active,
      })
      .subscribe({
        next: () => {
          this.closeForm();
          this.reload();
        },
        error: (err) => {
          const parsed = parseApiError(err, 'No se pudo guardar el usuario');
          this.formError = parsed.message;
          this.apiErrors = parsed.fieldErrors;
        },
      });
  }

  openResetPassword(item: PlatformUser) {
    this.passwordUserId = item.id;
    this.passwordForm = { password: '', password_confirmation: '' };
    this.passwordError = '';
    this.passwordApiErrors = {};
    this.passwordOpen.set(true);
  }

  closePassword() {
    this.passwordUserId = null;
    this.passwordOpen.set(false);
    this.passwordError = '';
    this.passwordApiErrors = {};
  }

  savePassword(f: NgForm) {
    this.passwordError = '';
    this.passwordApiErrors = {};
    if (f.invalid || !this.passwordUserId) {
      return;
    }

    this.api
      .put(`/users/${this.passwordUserId}/password`, this.passwordForm)
      .subscribe({
        next: () => this.closePassword(),
        error: (err) => {
          const parsed = parseApiError(err, 'No se pudo actualizar la contraseña');
          this.passwordError = parsed.message;
          this.passwordApiErrors = parsed.fieldErrors;
        },
      });
  }

  roleLabel(role: UserRole): string {
    return role === 'admin' ? 'Admin' : 'Staff';
  }

  private emptyForm(): UserForm {
    return {
      name: '',
      email: '',
      role: 'staff',
      is_active: true,
      password: '',
      password_confirmation: '',
    };
  }
}
