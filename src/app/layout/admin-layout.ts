import { Component, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout implements OnInit {
  readonly menuOpen = signal(false);
  readonly isMobile = signal(false);

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
    this.mediaQuery = window.matchMedia('(max-width: 900px)');
    this.syncViewport(this.mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => this.syncViewport(event.matches);
    this.mediaQuery.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => {
      this.mediaQuery?.removeEventListener('change', onChange);
      document.body.style.overflow = '';
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
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
