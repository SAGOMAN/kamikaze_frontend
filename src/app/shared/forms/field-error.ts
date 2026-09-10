import { Component, Input } from '@angular/core';
import { NgModel } from '@angular/forms';

@Component({
  selector: 'app-field-error',
  template: `
    @if (text) {
      <span class="field-error" role="alert">{{ text }}</span>
    }
  `,
})
export class FieldError {
  @Input() control: NgModel | null = null;
  @Input() submitted = false;
  @Input() apiError = '';
  /** Mensaje custom para `pattern` (p. ej. color HEX). */
  @Input() patternMessage = '';
  /** Mensaje custom para `minlength`. */
  @Input() minLengthMessage = '';

  get text(): string {
    if (this.apiError) {
      return this.apiError;
    }
    if (!this.control?.invalid) {
      return '';
    }
    if (!(this.submitted || this.control.touched)) {
      return '';
    }
    const errors = this.control.errors;
    if (!errors) return '';

    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['email']) return 'Ingresa un correo válido.';
    if (errors['pattern']) return this.patternMessage || 'El formato no es válido.';
    if (errors['min']) {
      const min = errors['min']?.min;
      return typeof min === 'number' ? `El valor mínimo es ${min}.` : 'El valor es demasiado bajo.';
    }
    if (errors['max']) {
      const max = errors['max']?.max;
      return typeof max === 'number' ? `El valor máximo es ${max}.` : 'El valor es demasiado alto.';
    }
    if (errors['minlength']) {
      if (this.minLengthMessage) return this.minLengthMessage;
      const req = errors['minlength']?.requiredLength;
      return typeof req === 'number'
        ? `Debe tener al menos ${req} caracteres.`
        : 'El texto es demasiado corto.';
    }
    if (errors['maxlength']) {
      const req = errors['maxlength']?.requiredLength;
      return typeof req === 'number'
        ? `No puede superar ${req} caracteres.`
        : 'El texto es demasiado largo.';
    }

    return 'El valor no es válido.';
  }
}
