/**
 * Error hierarchy thrown by the SDK.
 *
 * ```text
 * AfficError                      every SDK error
 * ├─ AfficConfigurationError      the client was constructed wrong (missing key, browser)
 * ├─ AfficAPIError                the API answered with a non-2xx status
 * │  ├─ AfficBadRequestError      400 — the payload failed validation
 * │  ├─ AfficAuthenticationError  401 — missing or unknown x-api-key
 * │  ├─ AfficNotFoundError        404 — the trackId matches no affiliate of this program
 * │  └─ AfficInternalServerError  5xx — safe to retry, nothing was recorded
 * └─ AfficConnectionError         the request never produced a response
 *    └─ AfficTimeoutError         the request exceeded the configured timeout
 * ```
 *
 * Branch on the error class and on {@link AfficAPIError.codes} — never on message prose, which is
 * not part of the API contract.
 */

import { parseErrorEnvelope } from './internal/parse.js';

/** Base class for every error thrown by this SDK. */
export class AfficError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    Error.captureStackTrace(this, new.target);
  }
}

/**
 * The client could not be used as configured: no API key, or a browser environment.
 *
 * Always a programming error — it never depends on the network or on API state.
 */
export class AfficConfigurationError extends AfficError {}

/**
 * A method was called with arguments that cannot produce a valid request — an empty activity
 * name, or a non-finite `value`.
 *
 * Caught client-side so a malformed call never reaches the API, where it would be rejected or,
 * worse, recorded with no commission.
 */
export class AfficInvalidArgumentError extends AfficError {}

/** Data needed to build an {@link AfficAPIError}. */
export interface AfficAPIErrorInit {
  /** HTTP status code of the response. */
  readonly status: number;
  /** Machine-readable codes or validation messages from the envelope. Empty when unparseable. */
  readonly codes: readonly string[];
  /** HTTP reason phrase from the envelope, or the raw body when it could not be parsed. */
  readonly error: string;
  /** Response headers, lower-cased. */
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * The API answered with a non-2xx status.
 *
 * Prefer catching a subclass ({@link AfficAuthenticationError}, {@link AfficBadRequestError},
 * {@link AfficInternalServerError}); this base class is thrown for any other status.
 */
export class AfficAPIError extends AfficError {
  /** HTTP status code of the response. */
  readonly status: number;

  /**
   * Machine-readable error codes, for example `['INTEGRATION_NOT_FOUND']`, or the validation
   * messages produced when the body is malformed. Empty when the response body did not match the
   * documented envelope.
   */
  readonly codes: readonly string[];

  /** HTTP reason phrase (`'Unauthorized'`), or the raw body when it could not be parsed. */
  readonly error: string;

  /** Response headers, lower-cased. */
  readonly headers: Readonly<Record<string, string>>;

  constructor(message: string, init: AfficAPIErrorInit, options?: ErrorOptions) {
    super(message, options);
    this.status = init.status;
    this.codes = init.codes;
    this.error = init.error;
    this.headers = init.headers;
  }

  /**
   * Builds the most specific error class for a response.
   *
   * Never throws: an unparseable body degrades to empty {@link AfficAPIError.codes} and the raw
   * text on {@link AfficAPIError.error}.
   */
  static from(
    status: number,
    rawBody: string,
    headers: Readonly<Record<string, string>>,
  ): AfficAPIError {
    const envelope = parseErrorEnvelope(rawBody);
    const init: AfficAPIErrorInit = {
      status,
      codes: envelope?.message ?? [],
      error: envelope?.error ?? rawBody.trim(),
      headers,
    };
    const message = formatMessage(init);

    if (status === 400) {
      return new AfficBadRequestError(message, init);
    }
    if (status === 401) {
      return new AfficAuthenticationError(message, init);
    }
    if (status === 404) {
      return new AfficNotFoundError(message, init);
    }
    if (status >= 500) {
      return new AfficInternalServerError(message, init);
    }
    return new AfficAPIError(message, init);
  }
}

/**
 * `400` — the request body failed validation: wrong types, a `trackId` that is not twelve url-safe
 * characters, a `data` payload that is not an object or serializes past 4096 bytes, or unknown
 * fields. Retrying the same payload will fail again.
 */
export class AfficBadRequestError extends AfficAPIError {}

/**
 * `401` — the `x-api-key` header is missing, or no integration matches it
 * (`INTEGRATION_NOT_FOUND`).
 */
export class AfficAuthenticationError extends AfficAPIError {}

/**
 * `404` — the `trackId` matches no active affiliate of the program that owns the API key
 * (`TRACK_NOT_FOUND`). A trackId belonging to another program is reported the same way as one that
 * never existed.
 *
 * The activity was **not** recorded, and retrying the same payload will fail again. Either send a
 * trackId your storefront actually received in the `__affic` parameter, or send `null` to record
 * the activity against the program with no affiliate credited.
 */
export class AfficNotFoundError extends AfficAPIError {}

/**
 * `5xx` — unexpected server error. The activity was **not** recorded, so the call is safe to
 * retry. The SDK never retries on its own because the endpoint is not idempotent.
 */
export class AfficInternalServerError extends AfficAPIError {}

/**
 * The request never produced a response: DNS failure, refused connection, TLS error, dropped
 * socket, or an abort triggered by the caller.
 *
 * Whether the activity was recorded is unknowable, so retrying risks a duplicate.
 */
export class AfficConnectionError extends AfficError {}

/** The request exceeded the configured timeout and was aborted by the SDK. */
export class AfficTimeoutError extends AfficConnectionError {
  /** Timeout that elapsed, in milliseconds. */
  readonly timeout: number;

  constructor(message: string, timeout: number, options?: ErrorOptions) {
    super(message, options);
    this.timeout = timeout;
  }
}

function formatMessage(init: AfficAPIErrorInit): string {
  const detail = init.codes.length > 0 ? init.codes.join(', ') : init.error;
  const suffix = detail.length > 0 ? `: ${detail}` : '';

  return `Affic API error (status ${String(init.status)})${suffix}`;
}
