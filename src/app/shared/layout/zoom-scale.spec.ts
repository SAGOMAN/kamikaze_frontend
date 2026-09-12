describe('escala proporcional (rem)', () => {
  it('duplica el tamaño de un bloque en rem al duplicar el font-size raíz', () => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    const el = document.createElement('div');
    el.style.width = '10rem';
    el.style.height = '2rem';
    document.body.appendChild(el);

    root.style.fontSize = '16px';
    const at16 = el.getBoundingClientRect().width;

    root.style.fontSize = '32px';
    const at32 = el.getBoundingClientRect().width;

    expect(at16).toBeGreaterThan(0);
    expect(at32 / at16).toBeCloseTo(2, 5);

    root.style.fontSize = previous;
    el.remove();
  });
});
