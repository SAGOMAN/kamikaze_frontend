import { Component, Input } from '@angular/core';
import { NgModel } from '@angular/forms';

const CLIENT_MESSAGES: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  email: 'Ingresa un correo válido.',
  pattern: 'El formato no es válido.',
  min: 'El valor es demasiado bajo.',
  max: 'El valor es demasiado alto.',
  minlength: 'El texto es demasiado corto.',
  maxlength: 'El texto es demasiado largo.',
};

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

    if (errors['required']) return CLIENT_MESSAGES['required'];
    if (errors['email']) return CLIENT_MESSAGES['email'];
    if (errors['pattern']) return this.patternMessage || CLIENT_MESSAGES['pattern'];
    if (errors['min']) return CLIENT_MESSAGES['min'];
    if (errors['max']) return CLIENT_MESSAGES['max'];
    if (errors['minlength']) return CLIENT_MESSAGES['minlength'];
    if (errors['maxlength']) return CLIENT_MESSAGES['maxlength'];

    const key = Object.keys(errors)[0];
    return key ? CLIENT_MESSAGES[key] || 'Valor no válido.' : '';
  }
}
