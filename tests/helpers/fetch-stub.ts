import type { FetchLike } from '../../src/types.js';

/** One captured call to the stubbed `fetch`. */
export interface CapturedCall {
  readonly url: string;
  readonly init: RequestInit;
}

/** A `fetch` double that records calls and answers with canned responses. */
export interface FetchStub {
  readonly fetch: FetchLike;
  readonly calls: CapturedCall[];
  /** The single call made, failing loudly when there was not exactly one. */
  lastCall(): CapturedCall;
  /** The parsed JSON body of the last call. */
  lastBody(): unknown;
  /** Headers of the last call, as a plain object. */
  lastHeaders(): Record<string, string>;
}

/** Builds a stub that answers every call with `response` (or the result of `respond`). */
export function fetchStub(respond: Response | (() => Response | Promise<Response>)): FetchStub {
  const calls: CapturedCall[] = [];

  const stub: FetchStub = {
    fetch: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(typeof respond === 'function' ? respond() : respond.clone());
    },
    calls,
    lastCall() {
      const call = calls.at(-1);
      if (call === undefined) {
        throw new Error('fetch was never called');
      }
      return call;
    },
    lastBody() {
      const { body } = this.lastCall().init;
      if (typeof body !== 'string') {
        throw new Error('expected a string request body');
      }
      return JSON.parse(body) as unknown;
    },
    lastHeaders() {
      return { ...(this.lastCall().init.headers as Record<string, string>) };
    },
  };

  return stub;
}

/** A `fetch` double that never answers until the request is aborted. */
export function hangingFetch(): FetchLike {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(new Error('This operation was aborted'));
      });
    });
}

/** Builds a `204 No Content` response, the API's success answer. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** Builds an error response carrying the documented envelope. */
export function errorResponse(
  status: number,
  message: string[],
  error: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ statusCode: status, message, error }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
