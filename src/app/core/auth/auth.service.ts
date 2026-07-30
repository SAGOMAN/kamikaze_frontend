import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'hanuman_token';
  readonly user = signal<AuthUser | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {
    const raw = localStorage.getItem('hanuman_user');
    if (raw) {
      this.user.set(JSON.parse(raw));
    }
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem('hanuman_user', JSON.stringify(res.user));
        this.user.set(res.user);
      }),
    );
  }

  logout() {
    const finish = () => {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem('hanuman_user');
      this.user.set(null);
      this.router.navigateByUrl('/login');
    };

    if (!this.token) {
      finish();
      return;
    }

    this.http.post(`${environment.apiUrl}/logout`, {}).subscribe({
      next: finish,
      error: finish,
    });
  }
}
