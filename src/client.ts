import { AfficAPIError, AfficConfigurationError } from './errors.js';
import { API_KEY_ENV_VAR, isBrowserLike, nodeVersion, readApiKeyFromEnv } from './internal/env.js';
import { sendRequest } from './internal/fetch.js';
import type { RequestExecutor } from './internal/request.js';
import { VERSION } from './internal/version.js';
import { Activity } from './resources/activity.js';
import type { ClientOptions, FetchLike, JsonObject, RequestOptions } from './types.js';

/** Origin used when {@link ClientOptions.baseURL} is not set. */
export const DEFAULT_BASE_URL = 'https://server.affic.com.br';

/** Request timeout used when {@link ClientOptions.timeout} is not set, in milliseconds. */
export const DEFAULT_TIMEOUT = 60_000;

/**
 * Client for the Affic integration API.
 *
 * Server-only: the integration token authenticates a whole program, so it must never reach a
 * browser. The constructor throws if it detects one.
 *
 * @example
 * ```ts
 * import { Affic } from '@affic/sdk';
 *
 * const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });
 *
 * await client.activity.create({ name: 'purchase', value: 149.9 });
 * ```
 */
export class Affic implements RequestExecutor {
  /** Activity reporting. */
  readonly activity: Activity;

  /** Origin every request is sent to, without a trailing slash. */
  readonly baseURL: string;

  /** Default request timeout in milliseconds. */
  readonly timeout: number;

  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #defaultHeaders: Readonly<Record<string, string>>;

  /**
   * @param options - Client configuration. The API key falls back to `process.env.AFFIC_API_KEY`.
   *
   * @throws {AfficConfigurationError} when no API key is available, when `baseURL` is not an
   * absolute URL, when `timeout` is not a positive finite number, or when the SDK is loaded in a
   * browser.
   */
  constructor(options: ClientOptions = {}) {
    if (isBrowserLike()) {
      throw new AfficConfigurationError(
        'The Affic SDK is server-only. Running it in a browser would expose your integration ' +
          'token to every visitor. Call the API from your backend instead.',
      );
    }

    const apiKey = options.apiKey ?? readApiKeyFromEnv();
    if (apiKey === undefined || apiKey.trim() === '') {
      throw new AfficConfigurationError(
        `Missing API key. Pass it as \`new Affic({ apiKey: '...' })\` or set the ` +
          `${API_KEY_ENV_VAR} environment variable.`,
      );
    }

    const baseURL = options.baseURL ?? DEFAULT_BASE_URL;
    if (!URL.canParse(baseURL)) {
      throw new AfficConfigurationError(
        `Invalid baseURL: ${baseURL}. Expected an absolute URL such as ${DEFAULT_BASE_URL}.`,
      );
    }

    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new AfficConfigurationError(
        `Invalid timeout: ${String(timeout)}. Expected a positive number of milliseconds.`,
      );
    }

    this.#apiKey = apiKey;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#defaultHeaders = lowerCaseKeys(options.defaultHeaders ?? {});
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.timeout = timeout;
    this.activity = new Activity(this);
  }

  /**
   * Sends a JSON body to `path` and resolves once the API answers with a 2xx.
   *
   * Resources call this; application code should use the resource methods.
   *
   * @throws {import('./errors.js').AfficAPIError} on any non-2xx response.
   * @throws {import('./errors.js').AfficConnectionError} when the request never reaches the API.
   * @throws {import('./errors.js').AfficTimeoutError} when the timeout elapses.
   *
   * @internal
   */
  async post(path: string, body: JsonObject, options: RequestOptions = {}): Promise<void> {
    const response = await sendRequest({
      fetch: this.#fetch,
      url: `${this.baseURL}${path}`,
      method: 'POST',
      headers: this.#buildHeaders(options.headers),
      body: JSON.stringify(body),
      timeout: options.timeout ?? this.timeout,
      signal: options.signal,
    });

    if (!response.ok) {
      throw AfficAPIError.from(response.status, await readBody(response), toHeaderRecord(response));
    }

    // Successful calls answer 204 with no body, but any bytes still have to be consumed for the
    // socket to return to the pool.
    await readBody(response);
  }

  #buildHeaders(perRequest: Readonly<Record<string, string>> | undefined): Record<string, string> {
    return {
      'x-api-key': this.#apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': `affic-sdk-node/${VERSION} node/${nodeVersion()}`,
      ...this.#defaultHeaders,
      ...lowerCaseKeys(perRequest ?? {}),
    };
  }
}

function lowerCaseKeys(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
}

function toHeaderRecord(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};

  response.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });

  return headers;
}

/** Reads a response body, never throwing: a broken stream must not mask the real error. */
async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
