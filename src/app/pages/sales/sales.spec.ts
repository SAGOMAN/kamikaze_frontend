import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Branch, PaginatedResponse, Product, Sale } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { SalesPage } from './sales';

describe('SalesPage', () => {
  let component: SalesPage;
  let fixture: ComponentFixture<SalesPage>;
  let api: jasmine.SpyObj<ApiService>;

  const centro: Branch = { id: 1, name: 'Centro', is_active: true, color: '#C45C26' };
  const norte: Branch = { id: 2, name: 'Norte', is_active: true, color: '#2563EB' };

  const gloves: Product = {
    id: 10,
    name: 'Guantes',
    sku: 'GNT',
    unit_price: 150,
    is_active: true,
    stocks: [
      { id: 1, product_id: 10, branch_id: 1, quantity: 8 },
      { id: 2, product_id: 10, branch_id: 2, quantity: 1 },
    ],
  };
  const kimono: Product = {
    id: 11,
    name: 'Kimono',
    sku: 'KIM',
    unit_price: 900,
    is_active: true,
    stocks: [{ id: 3, product_id: 11, branch_id: 2, quantity: 4 }],
  };
  const protector: Product = {
    id: 12,
    name: 'Protector',
    unit_price: 80,
    is_active: true,
    stocks: [{ id: 4, product_id: 12, branch_id: 1, quantity: 0 }],
  };

  const emptySales: PaginatedResponse<Sale> = {
    data: [],
    meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 },
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj('ApiService', ['get', 'post', 'delete']);
    api.get.and.callFake(((path: string) => {
      if (path === '/branches') return of([centro, norte]);
      if (path === '/products') return of([gloves, kimono, protector]);
      return of(emptySales);
    }) as ApiService['get']);

    await TestBed.configureTestingModule({
      imports: [SalesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: jasmine.createSpyObj('ConfirmService', ['ask']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SalesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('al elegir sucursal solo lista productos asignados a esa sucursal', () => {
    component.onFormBranchChange(1);
    expect(component.availableProducts().map((p) => p.id)).toEqual([10, 12]);

    component.onFormBranchChange(2);
    expect(component.availableProducts().map((p) => p.id)).toEqual([10, 11]);
  });

  it('muestra stock de la sucursal seleccionada, no el de otras', () => {
    component.onFormBranchChange(1);
    expect(component.stockFor(gloves)).toBe(8);

    component.onFormBranchChange(2);
    expect(component.stockFor(gloves)).toBe(1);
    expect(component.stockFor(kimono)).toBe(4);
    expect(component.stockFor(protector)).toBe(0);
  });

  it('al cambiar de sucursal vacía el carrito', () => {
    component.onFormBranchChange(1);
    component.addProduct(gloves);
    expect(component.items.length).toBe(1);

    component.onFormBranchChange(2);
    expect(component.items).toEqual([]);
  });

  it('no agrega un producto sin stock en la sucursal', () => {
    component.onFormBranchChange(1);
    component.addProduct(protector);
    expect(component.items.length).toBe(0);
  });

  it('no agrega un producto que no pertenece a la sucursal', () => {
    component.onFormBranchChange(1);
    component.addProduct(kimono);
    expect(component.items.length).toBe(0);
  });

  it('incrementa cantidad si el producto ya está en el carrito y hay stock', () => {
    component.onFormBranchChange(1);
    component.addProduct(gloves);
    component.addProduct(gloves);
    expect(component.items).toEqual([{ product_id: 10, quantity: 2 }]);
  });

  it('no permite superar el stock de la sucursal', () => {
    component.onFormBranchChange(2);
    component.addProduct(gloves);
    expect(component.canAdd(gloves)).toBeFalse();
    component.addProduct(gloves);
    expect(component.items[0].quantity).toBe(1);
  });

  it('calcula el total con precios de los productos', () => {
    component.onFormBranchChange(1);
    component.addProduct(gloves);
    component.addProduct(gloves);
    expect(component.draftTotal()).toBe(300);
  });
});
