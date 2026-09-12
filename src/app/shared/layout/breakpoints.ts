/**
 * Breakpoints en em para alinear JS con las media queries CSS.
 * El em se calcula respecto al font-size raíz, así el zoom del navegador
 * no dispara layouts “móviles” de forma desproporcionada.
 *
 * Equivalencias a 16px de raíz:
 *   sm 30em = 480px, md 32.5em = 520px, tablet 45em = 720px,
 *   nav 56.25em = 900px, wide 60em = 960px.
 */
export const BREAKPOINT_EM = {
  sm: 30,
  md: 32.5,
  tablet: 45,
  nav: 56.25,
  wide: 60,
} as const;

export const MEDIA = {
  maxSm: `(max-width: ${BREAKPOINT_EM.sm}em)`,
  maxMd: `(max-width: ${BREAKPOINT_EM.md}em)`,
  maxTablet: `(max-width: ${BREAKPOINT_EM.tablet}em)`,
  maxNav: `(max-width: ${BREAKPOINT_EM.nav}em)`,
  maxWide: `(max-width: ${BREAKPOINT_EM.wide}em)`,
} as const;

export function matchesMedia(query: string): boolean {
  return window.matchMedia(query).matches;
}

export function isNavCompact(): boolean {
  return matchesMedia(MEDIA.maxNav);
}
