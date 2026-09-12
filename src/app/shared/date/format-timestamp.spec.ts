import { formatCivilDate, formatTimestamp } from './format-timestamp';

describe('formatTimestamp', () => {
  it('convierte medianoche local serializada en UTC (T05:00:00Z) a 00:00:00', () => {
    expect(formatTimestamp('2026-09-12T05:00:00.000000Z')).toBe('2026-09-12 00:00:00');
  });

  it('deja fechas civiles YYYY-MM-DD a medianoche de negocio', () => {
    expect(formatTimestamp('2026-09-12')).toBe('2026-09-12 00:00:00');
  });

  it('no altera datetimes ya locales', () => {
    expect(formatTimestamp('2026-09-12 14:30:00')).toBe('2026-09-12 14:30:00');
  });

  it('convierte timestamps ISO con Z a America/Guayaquil', () => {
    expect(formatTimestamp('2026-09-12T20:30:00.000000Z')).toBe('2026-09-12 15:30:00');
  });

  it('muestra vacío como raya', () => {
    expect(formatTimestamp(null)).toBe('—');
    expect(formatTimestamp('')).toBe('—');
  });
});

describe('formatCivilDate', () => {
  it('muestra solo yyyy-mm-dd, sin hora', () => {
    expect(formatCivilDate('2026-09-12T05:00:00.000000Z')).toBe('2026-09-12');
    expect(formatCivilDate('2026-09-12 00:00:00')).toBe('2026-09-12');
    expect(formatCivilDate('2026-09-12')).toBe('2026-09-12');
  });
});
