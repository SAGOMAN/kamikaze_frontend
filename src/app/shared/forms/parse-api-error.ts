export interface ParsedApiError {
  message: string;
  fieldErrors: Record<string, string>;
}

const GENERIC_ENGLISH = new Set([
  'the given data was invalid.',
  'unauthenticated.',
  'this action is unauthorized.',
  'server error',
  'not found.',
]);

const STATUS_FALLBACKS: Record<number, string> = {
  401: 'Tu sesión expiró o no estás autenticado. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscabas.',
  419: 'La sesión expiró. Recarga la página e inténtalo de nuevo.',
  422: 'Revisa los datos del formulario.',
  429: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  500: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
};

/**
 * Extrae mensaje y errores por campo del shape Laravel 422:
 * `{ message, errors: { campo: [string] } }`.
 */
export function parseApiError(err: unknown, fallback: string): ParsedApiError {
  const httpErr = err as {
    status?: number;
    error?: Record<string, unknown> | string | null;
  } | null;

  const status = typeof httpErr?.status === 'number' ? httpErr.status : 0;
  const rawBody = httpErr?.error;
  const body =
    rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : null;

  const fieldErrors: Record<string, string> = {};

  if (body) {
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
  }

  const firstField = Object.values(fieldErrors)[0];
  if (firstField) {
    return { message: firstField, fieldErrors };
  }

  let message = '';
  if (body && typeof body['message'] === 'string' && body['message']) {
    message = body['message'];
  } else if (typeof rawBody === 'string' && rawBody.trim()) {
    message = rawBody.trim();
  }

  if (message && !GENERIC_ENGLISH.has(message.toLowerCase())) {
    return { message, fieldErrors };
  }

  const statusFallback = STATUS_FALLBACKS[status];
  return {
    message: statusFallback || fallback,
    fieldErrors,
  };
}
