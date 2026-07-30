import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Branch } from '../../core/models';

@Component({
  selector: 'app-branches',
  imports: [FormsModule],
  templateUrl: './branches.html',
})
export class BranchesPage implements OnInit {
  readonly items = signal<Branch[]>([]);
  form: Partial<Branch> = { name: '', address: '', is_active: true };
  editingId: number | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.get<Branch[]>('/branches').subscribe((data) => this.items.set(data));
  }

  edit(item: Branch) {
    this.editingId = item.id;
    this.form = { ...item };
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
      this.reset();
      this.reload();
    });
  }

  remove(id: number) {
    if (!confirm('¿Eliminar sucursal?')) return;
    this.api.delete(`/branches/${id}`).subscribe(() => this.reload());
  }
}
