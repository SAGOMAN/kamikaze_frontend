export interface ParsedApiError {
  message: string;
  fieldErrors: Record<string, string>;
}

/**
 * Extrae mensaje y errores por campo del shape Laravel 422:
 * `{ message, errors: { campo: [string] } }`.
 */
export function parseApiError(err: unknown, fallback: string): ParsedApiError {
  const body = (err as { error?: Record<string, unknown> } | null)?.error;
  const fieldErrors: Record<string, string> = {};

  if (!body || typeof body !== 'object') {
    return { message: fallback, fieldErrors };
  }

  const errors = body['errors'];
  if (errors && typeof errors === 'object') {
    for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) {
        fieldErrors[key] = value[0];
      } else if (typeof value === 'string' && value) {
        fieldErrors[key] = value;
      }
    }
  }

  // Compat: algunos clientes antiguos leían campos en la raíz (login/sales).
  for (const [key, value] of Object.entries(body)) {
    if (key === 'message' || key === 'errors') continue;
    if (fieldErrors[key]) continue;
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) {
      fieldErrors[key] = value[0];
    }
  }

  let message = fallback;
  if (typeof body['message'] === 'string' && body['message']) {
    message = body['message'];
  } else {
    const first = Object.values(fieldErrors)[0];
    if (first) message = first;
  }

  return { message, fieldErrors };
}
