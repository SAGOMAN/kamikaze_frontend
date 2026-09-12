import { Component, input } from '@angular/core';

export type ActionBtnIcon = 'create' | 'edit' | 'delete' | 'view' | 'back' | 'password';
export type ActionBtnVariant = 'default' | 'ghost' | 'danger';

@Component({
  selector: 'app-action-btn',
  templateUrl: './action-btn.html',
  styleUrl: './action-btn.css',
})
export class ActionBtn {
  readonly icon = input.required<ActionBtnIcon>();
  readonly label = input.required<string>();
  readonly variant = input<ActionBtnVariant>('ghost');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
}
