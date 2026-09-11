import { localDateIso, localYearMonth } from './local-iso-date';

describe('localIsoDate', () => {
  it('usa el día civil local, no UTC', () => {
    const evening = new Date(2026, 8, 10, 20, 30, 0);

    expect(localDateIso(evening)).toBe('2026-09-10');
    expect(localYearMonth(evening)).toBe('2026-09');
  });

  it('no salta de día a medianoche local', () => {
    const midnight = new Date(2026, 8, 10, 0, 0, 0);

    expect(localDateIso(midnight)).toBe('2026-09-10');
  });
});
