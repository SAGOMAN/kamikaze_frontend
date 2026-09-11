/** Fecha civil del reloj local (YYYY-MM-DD), sin convertir a UTC. */
export function localDateIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Año-mes local (YYYY-MM) para períodos de mensualidad. */
export function localYearMonth(date: Date = new Date()): string {
  return localDateIso(date).slice(0, 7);
}
