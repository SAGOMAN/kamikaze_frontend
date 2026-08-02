import { Component, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FieldError } from '../../shared/forms/field-error';
import { parseApiError } from '../../shared/forms/parse-api-error';
import { showInvalid } from '../../shared/forms/show-invalid';

@Component({
  selector: 'app-login',
  imports: [FormsModule, FieldError],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  email = 'admin@hanuman.style';
  password = 'password';
  readonly error = signal('');
  apiErrors: Record<string, string> = {};
  readonly loading = signal(false);
  readonly showInvalid = showInvalid;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    if (this.auth.isAuthenticated) {
      this.router.navigateByUrl('/app/dashboard');
    }
  }

  submit(f: NgForm) {
    this.error.set('');
    this.apiErrors = {};
    if (f.invalid) {
      return;
    }
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/app/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        const parsed = parseApiError(err, 'No se pudo iniciar sesión');
        this.error.set(parsed.message);
        this.apiErrors = parsed.fieldErrors;
      },
    });
  }
}
