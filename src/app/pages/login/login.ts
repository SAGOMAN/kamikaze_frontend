import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  email = 'admin@hanuman.style';
  password = 'password';
  readonly error = signal('');
  readonly loading = signal(false);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    if (this.auth.isAuthenticated) {
      this.router.navigateByUrl('/app/dashboard');
    }
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/app/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || err?.error?.email?.[0] || 'No se pudo iniciar sesión');
      },
    });
  }
}
