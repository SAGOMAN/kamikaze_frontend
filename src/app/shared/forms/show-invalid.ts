import { NgForm, NgModel } from '@angular/forms';

/** True si el control debe mostrarse inválido (tras submit o touched post-submit). */
export function showInvalid(form: NgForm | null | undefined, control: NgModel | null | undefined): boolean {
  if (!form || !control) return false;
  if (!control.invalid) return false;
  return !!(form.submitted || control.touched);
}
