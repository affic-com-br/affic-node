/**
 * Transport layer: one HTTP call, with a timeout, translated into SDK errors.
 *
 * Deliberately free of retries. The activity endpoint is not idempotent, so a transparent retry
 * after a timeout could double-count a sale. Retrying is the caller's decision, and only on `5xx`.
 */

import { AfficConnectionError, AfficTimeoutError } from '../errors.js';
import type { FetchLike } from '../types.js';

/** Everything {@link sendRequest} needs to perform a call. */
export interface SendRequestOptions {
  /** `fetch` implementation to call. */
  readonly fetch: FetchLike;
  /** Absolute URL. */
  readonly url: string;
  /** HTTP method. */
  readonly method: string;
  /** Fully resolved request headers. */
  readonly headers: Readonly<Record<string, string>>;
  /** Serialized request body, or `undefined` for bodiless methods. */
  readonly body: string | undefined;
  /** Milliseconds before the request is aborted. */
  readonly timeout: number;
  /** Caller-supplied abort signal, composed with the timeout. */
  readonly signal: AbortSignal | undefined;
}

/**
 * Performs the request and returns the raw {@link Response}, whatever its status.
 *
 * Only transport failures throw here: HTTP error statuses are the caller's business.
 *
 * @throws {AfficTimeoutError} when the configured timeout elapses first.
 * @throws {AfficConnectionError} when the caller aborts, or the request never reaches the API.
 */
export async function sendRequest(options: SendRequestOptions): Promise<Response> {
  // A signal that is already aborted must not open a connection at all: the endpoint is not
  // idempotent, so a request nobody is waiting for could still record an activity.
  if (options.signal?.aborted === true) {
    throw new AfficConnectionError(
      `Request to ${options.url} was aborted by the caller before it started.`,
      { cause: options.signal.reason },
    );
  }

  const controller = new AbortController();

  // Which of the two abort sources fired is recorded as it happens: reading `signal.aborted` in
  // the catch block instead would lose the race between them. The flags live on an object so the
  // compiler does not narrow them to their initial value across the awaited call.
  const aborted: { byTimeout: boolean; byCaller: boolean } = { byTimeout: false, byCaller: false };

  const abortByCaller = (): void => {
    aborted.byCaller = true;
    controller.abort(options.signal?.reason);
  };

  const timer = setTimeout(() => {
    aborted.byTimeout = true;
    controller.abort();
  }, options.timeout);

  options.signal?.addEventListener('abort', abortByCaller, { once: true });

  try {
    return await options.fetch(options.url, {
      method: options.method,
      headers: { ...options.headers },
      ...(options.body === undefined ? {} : { body: options.body }),
      signal: controller.signal,
    });
  } catch (cause) {
    if (aborted.byTimeout) {
      throw new AfficTimeoutError(
        `Request to ${options.url} timed out after ${String(options.timeout)}ms.`,
        options.timeout,
        { cause },
      );
    }
    if (aborted.byCaller) {
      throw new AfficConnectionError(`Request to ${options.url} was aborted by the caller.`, {
        cause,
      });
    }
    throw new AfficConnectionError(`Request to ${options.url} failed: ${describe(cause)}`, {
      cause,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortByCaller);
  }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
