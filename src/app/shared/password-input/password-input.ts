import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-password-input',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInput),
      multi: true,
    },
  ],
  templateUrl: './password-input.html',
  styleUrl: './password-input.css',
  host: {
    class: 'password-field',
    '[class.field-invalid]': 'invalid()',
  },
})
export class PasswordInput implements ControlValueAccessor {
  readonly autocomplete = input<string>('current-password');
  readonly placeholder = input('');
  readonly invalid = input(false);
  readonly inputId = input('');

  readonly visible = signal(false);
  readonly value = signal('');
  readonly disabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onInput(event: Event) {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  markTouched() {
    this.onTouched();
  }

  toggleVisible() {
    this.visible.update((v) => !v);
  }
}
