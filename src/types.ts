/**
 * Shared public types.
 *
 * They live apart from {@link "./client".Affic} so resources and transport can reference them
 * without importing the client, keeping the module graph acyclic.
 */

/** Any value that survives a JSON round trip. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

/**
 * A JSON request body.
 *
 * Declared as an interface rather than a `Record` alias: the alias form makes the mutual
 * recursion with {@link JsonValue} unresolvable, and the type silently degrades to `any`.
 */
export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * Minimal `fetch` shape the SDK depends on.
 *
 * The global `fetch` of Node 20+ satisfies it, and so does any wrapper you supply through
 * {@link ClientOptions.fetch} — a proxy agent, a logger, or a test double.
 */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Options accepted by the `Affic` constructor.
 *
 * Every option is written `?: T | undefined` rather than `?: T` so that consumers compiling with
 * `exactOptionalPropertyTypes` can pass a value that may be undefined — such as
 * `process.env['AFFIC_API_KEY']` — without a cast.
 */
export interface ClientOptions {
  /**
   * Integration token sent as the `x-api-key` header.
   *
   * Defaults to `process.env.AFFIC_API_KEY`. The token is secret: keep it server-side.
   */
  apiKey?: string | undefined;

  /**
   * Origin of the API.
   *
   * @defaultValue `'https://server.affic.com.br'`
   */
  baseURL?: string | undefined;

  /**
   * Milliseconds a request may take before the SDK aborts it and throws
   * {@link "./errors".AfficTimeoutError}.
   *
   * @defaultValue `60000`
   */
  timeout?: number | undefined;

  /**
   * `fetch` implementation to use.
   *
   * @defaultValue the global `fetch`
   */
  fetch?: FetchLike | undefined;

  /**
   * Headers added to every request. Header names are lower-cased; values set here override the
   * SDK's own headers, so use with care.
   */
  defaultHeaders?: Readonly<Record<string, string>> | undefined;
}

/** Per-call overrides. */
export interface RequestOptions {
  /** Aborts the request. Composed with the configured timeout. */
  signal?: AbortSignal | undefined;

  /** Overrides {@link ClientOptions.timeout} for this call only. */
  timeout?: number | undefined;

  /** Headers merged over {@link ClientOptions.defaultHeaders} for this call only. */
  headers?: Readonly<Record<string, string>> | undefined;
}
