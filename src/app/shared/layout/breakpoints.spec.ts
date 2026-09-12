import { BREAKPOINT_EM, MEDIA, isNavCompact, matchesMedia } from './breakpoints';

describe('breakpoints', () => {
  it('expone media queries en em, no en px', () => {
    expect(MEDIA.maxSm).toBe('(max-width: 30em)');
    expect(MEDIA.maxMd).toBe('(max-width: 32.5em)');
    expect(MEDIA.maxTablet).toBe('(max-width: 45em)');
    expect(MEDIA.maxNav).toBe('(max-width: 56.25em)');
    expect(MEDIA.maxWide).toBe('(max-width: 60em)');
    expect(Object.values(MEDIA).join(' ')).not.toMatch(/\d+px/);
  });

  it('mantiene la equivalencia 16px = 1em en los umbrales documentados', () => {
    expect(BREAKPOINT_EM.sm * 16).toBe(480);
    expect(BREAKPOINT_EM.md * 16).toBe(520);
    expect(BREAKPOINT_EM.tablet * 16).toBe(720);
    expect(BREAKPOINT_EM.nav * 16).toBe(900);
    expect(BREAKPOINT_EM.wide * 16).toBe(960);
  });

  it('isNavCompact usa matchMedia con el query de navegación', () => {
    const matchMedia = spyOn(window, 'matchMedia').and.returnValue({
      matches: true,
      media: MEDIA.maxNav,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList);

    expect(isNavCompact()).toBeTrue();
    expect(matchMedia).toHaveBeenCalledWith(MEDIA.maxNav);
    expect(matchesMedia(MEDIA.maxNav)).toBeTrue();
  });
});
