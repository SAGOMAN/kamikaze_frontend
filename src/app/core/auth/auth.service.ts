import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UserRole } from '../models';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'hanuman_token';
  readonly user = signal<AuthUser | null>(null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {
    const raw = localStorage.getItem('hanuman_user');
    if (raw) {
      try {
        this.user.set(JSON.parse(raw));
      } catch {
        localStorage.removeItem('hanuman_user');
      }
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
        this.persistUser(res.user);
      }),
    );
  }

  refreshMe() {
    return this.http.get<AuthUser>(`${environment.apiUrl}/me`).pipe(
      tap((user) => this.persistUser(user)),
    );
  }

  changePassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/me/password`, payload);
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

  private persistUser(user: AuthUser) {
    localStorage.setItem('hanuman_user', JSON.stringify(user));
    this.user.set(user);
  }
}
