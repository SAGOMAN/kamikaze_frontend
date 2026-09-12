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

  it('declara touch-action: manipulation en puntero grueso para el doble toque', () => {
    const rules: CSSRule[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        rules.push(...Array.from(sheet.cssRules));
      } catch {
        // hojas de otro origen
      }
    }

    const hasManipulation = rules.some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        /pointer\s*:\s*coarse/.test(rule.conditionText) &&
        Array.from(rule.cssRules).some(
          (inner) => inner instanceof CSSStyleRule && inner.style.touchAction === 'manipulation',
        ),
    );

    expect(hasManipulation).toBeTrue();
  });
});
