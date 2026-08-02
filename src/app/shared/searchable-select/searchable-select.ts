import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchableOption {
  value: number | string | null | undefined;
  label: string;
}

let searchableSelectSeq = 0;

@Component({
  selector: 'app-searchable-select',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelect),
      multi: true,
    },
  ],
  templateUrl: './searchable-select.html',
  styleUrl: './searchable-select.css',
})
export class SearchableSelect implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  readonly listId = `searchable-select-list-${++searchableSelectSeq}`;

  readonly options = input<SearchableOption[]>([]);
  readonly placeholder = input('Buscar…');
  readonly emptyLabel = input('Sin resultados');
  readonly invalid = input(false);
  /** Bloqueo UI adicional (p. ej. campo fijado en un flujo). */
  readonly locked = input(false);

  private readonly queryInput = viewChild<ElementRef<HTMLInputElement>>('queryInput');

  readonly open = signal(false);
  readonly query = signal('');
  readonly cvaDisabled = signal(false);
  readonly value = signal<number | string | null | undefined>(null);
  readonly activeIndex = signal(0);

  readonly disabled = computed(() => this.cvaDisabled() || this.locked());

  readonly selectedLabel = computed(() => {
    const current = this.value();
    const match = this.options().find((o) => o.value === current);
    return match?.label ?? '';
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    if (!q) return all;
    return all.filter((o) => o.label.toLowerCase().includes(q));
  });

  private onChange: (value: number | string | null | undefined) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      const label = this.selectedLabel();
      if (!this.open()) {
        this.query.set(label);
        this.syncInput(label);
      }
    });
  }

  writeValue(value: number | string | null | undefined): void {
    this.value.set(value ?? null);
    if (!this.open()) {
      const label = this.labelFor(value);
      this.query.set(label);
      this.syncInput(label);
    }
  }

  registerOnChange(fn: (value: number | string | null | undefined) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  onInput(event: Event) {
    if (this.disabled()) return;
    const text = (event.target as HTMLInputElement).value;
    this.query.set(text);
    this.activeIndex.set(0);
    if (!this.open()) {
      this.open.set(true);
    }
  }

  onFocus() {
    if (this.disabled()) return;
    this.open.set(true);
    this.query.set('');
    this.syncInput('');
    this.activeIndex.set(0);
  }

  toggle() {
    if (this.disabled()) return;
    if (this.open()) {
      this.closeAndSync();
      return;
    }
    this.onFocus();
    this.queryInput()?.nativeElement.focus();
  }

  selectOption(option: SearchableOption, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.value.set(option.value);
    this.query.set(option.label);
    this.open.set(false);
    this.syncInput(option.label);
    this.onChange(option.value);
    this.onTouched();
  }

  onKeydown(event: KeyboardEvent) {
    if (this.disabled()) return;
    const list = this.filtered();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) {
        this.open.set(true);
        this.query.set('');
        this.syncInput('');
      }
      this.activeIndex.set(Math.min(this.activeIndex() + 1, Math.max(list.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (!this.open() || !list.length) return;
      event.preventDefault();
      const idx = Math.min(this.activeIndex(), list.length - 1);
      this.selectOption(list[idx]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAndSync();
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.closeAndSync();
  }

  private closeAndSync() {
    this.open.set(false);
    const label = this.selectedLabel();
    this.query.set(label);
    this.syncInput(label);
    this.onTouched();
  }

  private labelFor(value: number | string | null | undefined): string {
    const match = this.options().find((o) => o.value === value);
    return match?.label ?? '';
  }

  private syncInput(text: string) {
    afterNextRender(
      () => {
        const el = this.queryInput()?.nativeElement;
        if (el && el.value !== text) {
          el.value = text;
        }
      },
      { injector: this.injector },
    );
  }
}
