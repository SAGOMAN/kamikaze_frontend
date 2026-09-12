import { Component, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { FieldError } from '../shared/forms/field-error';
import { parseApiError } from '../shared/forms/parse-api-error';
import { showInvalid } from '../shared/forms/show-invalid';
import { Modal } from '../shared/modal/modal';
import { MEDIA } from '../shared/layout/breakpoints';
import { PasswordInput } from '../shared/password-input/password-input';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, Modal, FieldError, PasswordInput],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout implements OnInit {
  readonly menuOpen = signal(false);
  readonly isMobile = signal(false);
  readonly passwordOpen = signal(false);
  passwordForm = {
    current_password: '',
    password: '',
    password_confirmation: '',
  };
  passwordError = '';
  passwordApiErrors: Record<string, string> = {};
  readonly showInvalid = showInvalid;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private mediaQuery?: MediaQueryList;

  constructor(readonly auth: AuthService) {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.closeMenu());
  }

  ngOnInit() {
    this.mediaQuery = window.matchMedia(MEDIA.maxNav);
    this.syncViewport(this.mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => this.syncViewport(event.matches);
    this.mediaQuery.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => {
      this.mediaQuery?.removeEventListener('change', onChange);
      document.body.style.overflow = '';
    });

    this.auth.refreshMe().subscribe({ error: () => undefined });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.passwordOpen()) {
      this.closePassword();
      return;
    }
    if (this.menuOpen()) {
      this.closeMenu();
    }
  }

  toggleMenu() {
    this.menuOpen.update((open) => !open);
    this.syncBodyScroll();
  }

  closeMenu() {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    this.syncBodyScroll();
  }

  openPassword() {
    this.passwordForm = {
      current_password: '',
      password: '',
      password_confirmation: '',
    };
    this.passwordError = '';
    this.passwordApiErrors = {};
    this.passwordOpen.set(true);
  }

  closePassword() {
    this.passwordOpen.set(false);
    this.passwordError = '';
    this.passwordApiErrors = {};
  }

  savePassword(f: NgForm) {
    this.passwordError = '';
    this.passwordApiErrors = {};
    if (f.invalid) {
      return;
    }

    this.auth.changePassword(this.passwordForm).subscribe({
      next: () => this.closePassword(),
      error: (err) => {
        const parsed = parseApiError(err, 'No se pudo cambiar la contraseña');
        this.passwordError = parsed.message;
        this.passwordApiErrors = parsed.fieldErrors;
      },
    });
  }

  logout() {
    this.closeMenu();
    this.auth.logout();
  }

  private syncViewport(mobile: boolean) {
    this.isMobile.set(mobile);
    if (!mobile) {
      this.menuOpen.set(false);
      document.body.style.overflow = '';
    }
  }

  private syncBodyScroll() {
    document.body.style.overflow = this.menuOpen() ? 'hidden' : '';
  }
}
