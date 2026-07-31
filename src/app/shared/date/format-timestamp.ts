/** Formato de visualización: yyyy-mm-dd H:i:s (sin cambiar zona horaria). */
export function formatTimestamp(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '—';
    }
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const h = String(value.getHours()).padStart(2, '0');
    const i = String(value.getMinutes()).padStart(2, '0');
    const s = String(value.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${i}:${s}`;
  }

  const raw = String(value).trim();

  const full = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (full) {
    return `${full[1]} ${full[2]}:${full[3]}:${full[4]}`;
  }

  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]} 00:00:00`;
  }

  return raw;
}
