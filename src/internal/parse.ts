/**
 * Parsing helpers for the API's error envelope.
 *
 * This is the only place in the SDK that touches untyped JSON. `JSON.parse` returns `any`, so the
 * result is immediately widened to `unknown` and narrowed through explicit type guards: nothing
 * unvalidated escapes this module.
 */

/**
 * Error envelope shared by every non-2xx response.
 *
 * @see https://server.affic.com.br/api/docs/integration-api.json
 */
export interface ApiErrorEnvelope {
  /** HTTP status code, repeated in the body. */
  readonly statusCode: number;
  /**
   * Machine-readable error codes (for example `INTEGRATION_NOT_FOUND`) or validation messages.
   * Always an array.
   */
  readonly message: readonly string[];
  /** Standard HTTP reason phrase for `statusCode`, such as `Unauthorized`. */
  readonly error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Parses an error response body into the documented envelope.
 *
 * Returns `null` when the body is not JSON or does not match the contract — a gateway HTML page,
 * an empty body, or a future shape. Callers fall back to the raw text so an unexpected payload
 * degrades the error message instead of throwing while building an error.
 */
export function parseErrorEnvelope(rawBody: string): ApiErrorEnvelope | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const { statusCode, message, error } = parsed;

  if (typeof statusCode !== 'number' || !isStringArray(message) || typeof error !== 'string') {
    return null;
  }

  return { statusCode, message, error };
}
