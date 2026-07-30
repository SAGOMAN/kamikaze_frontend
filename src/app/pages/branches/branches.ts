import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Modal } from '../../shared/modal/modal';

@Component({
  selector: 'app-branches',
  imports: [FormsModule, Modal],
  templateUrl: './branches.html',
})
export class BranchesPage implements OnInit {
  readonly items = signal<Branch[]>([]);
  readonly formOpen = signal(false);
  form: Partial<Branch> = { name: '', address: '', is_active: true };
  editingId: number | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.get<Branch[]>('/branches').subscribe((data) => this.items.set(data));
  }

  openCreate() {
    this.reset();
    this.formOpen.set(true);
  }

  edit(item: Branch) {
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
    this.form = { name: '', address: '', is_active: true };
  }

  save() {
    const req = this.editingId
      ? this.api.put<Branch>(`/branches/${this.editingId}`, this.form)
      : this.api.post<Branch>('/branches', this.form);

    req.subscribe(() => {
      this.closeForm();
      this.reload();
    });
  }

  async remove(id: number) {
    const ok = await this.confirm.ask('¿Está seguro de que desea eliminar esta sucursal?');
    if (!ok) return;
    this.api.delete(`/branches/${id}`).subscribe(() => this.reload());
  }
}
