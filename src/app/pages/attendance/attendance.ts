import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Attendance, Branch, Student } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';

@Component({
  selector: 'app-attendance',
  imports: [FormsModule],
  templateUrl: './attendance.html',
})
export class AttendancePage implements OnInit {
  readonly branches = signal<Branch[]>([]);
  readonly students = signal<Student[]>([]);
  readonly attendances = signal<Attendance[]>([]);
  date = new Date().toISOString().slice(0, 10);
  branchId: number | null = null;

  readonly presentIds = computed(() => new Set(this.attendances().map((a) => a.student_id)));

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.api.get<Branch[]>('/branches').subscribe((data) => {
      this.branches.set(data.filter((b) => b.is_active));
      if (data.length && !this.branchId) {
        this.branchId = data[0].id;
        this.reload();
      }
    });
    this.api.get<Student[]>('/students', { is_active: true }).subscribe((data) => this.students.set(data));
  }

  reload() {
    if (!this.branchId) return;
    this.api
      .get<Attendance[]>('/attendances', { date: this.date, branch_id: this.branchId })
      .subscribe((data) => this.attendances.set(data));
  }

  label(s: Student) {
    return s.nickname ? `${s.first_name} ${s.last_name} (${s.nickname})` : `${s.first_name} ${s.last_name}`;
  }

  isPresent(studentId: number) {
    return this.presentIds().has(studentId);
  }

  async toggle(student: Student) {
    if (!this.branchId) return;

    const existing = this.attendances().find((a) => a.student_id === student.id);
    if (existing) {
      const ok = await this.confirm.ask(
        `¿Está seguro de que desea quitar la asistencia de ${this.label(student)}?`,
      );
      if (!ok) return;
      this.api.delete(`/attendances/${existing.id}`).subscribe(() => this.reload());
      return;
    }

    this.api
      .post('/attendances', {
        student_id: student.id,
        branch_id: this.branchId,
        attendance_date: this.date,
      })
      .subscribe(() => this.reload());
  }
}
