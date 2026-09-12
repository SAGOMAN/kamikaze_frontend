/** Zona de negocio (UTC-5, sin DST). Alineada con backend BusinessClock. */
export const BUSINESS_TIME_ZONE = 'America/Guayaquil';

const BUSINESS_OFFSET_MS = -5 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatInBusinessTimezone(date: Date): string {
  const shifted = new Date(date.getTime() + BUSINESS_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = pad2(shifted.getUTCMonth() + 1);
  const d = pad2(shifted.getUTCDate());
  const h = pad2(shifted.getUTCHours());
  const i = pad2(shifted.getUTCMinutes());
  const s = pad2(shifted.getUTCSeconds());
  return `${y}-${m}-${d} ${h}:${i}:${s}`;
}

/** Formato de visualización: yyyy-mm-dd H:i:s en zona de negocio. */
export function formatTimestamp(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '—';
    }
    return formatInBusinessTimezone(value);
  }

  const raw = String(value).trim();

  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]} 00:00:00`;
  }

  const naive = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (naive) {
    return `${naive[1]} ${naive[2]}:${naive[3]}:${naive[4]}`;
  }

  const isoTz = raw.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  if (isoTz) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }
    return formatInBusinessTimezone(date);
  }

  const full = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (full) {
    return `${full[1]} ${full[2]}:${full[3]}:${full[4]}`;
  }

  return raw;
}

/** Solo el día civil (yyyy-mm-dd), sin hora. */
export function formatCivilDate(value: string | number | Date | null | undefined): string {
  const formatted = formatTimestamp(value);
  if (formatted === '—') {
    return '—';
  }
  const match = formatted.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : formatted;
}
