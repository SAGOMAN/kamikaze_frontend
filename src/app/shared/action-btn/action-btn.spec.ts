import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActionBtn } from './action-btn';

describe('ActionBtn', () => {
  let fixture: ComponentFixture<ActionBtn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionBtn],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionBtn);
    fixture.componentRef.setInput('icon', 'edit');
    fixture.componentRef.setInput('label', 'Editar');
    fixture.detectChanges();
  });

  it('expone tooltip y aria-label con el texto de la acción', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.title).toBe('Editar');
    expect(button.getAttribute('aria-label')).toBe('Editar');
    expect(button.textContent).toContain('Editar');
  });
});
