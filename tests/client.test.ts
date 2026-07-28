import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Affic, DEFAULT_BASE_URL, DEFAULT_TIMEOUT } from '../src/client.js';
import {
  AfficAuthenticationError,
  AfficBadRequestError,
  AfficConfigurationError,
  AfficConnectionError,
  AfficInternalServerError,
  AfficTimeoutError,
} from '../src/errors.js';
import { VERSION } from '../src/internal/version.js';
import type { FetchLike } from '../src/types.js';

import { errorResponse, fetchStub, hangingFetch, noContent } from './helpers/fetch-stub.js';

const API_KEY = 'sk_test_123';
const ACTIVITY_PATH = '/api/v1/integration-api/activity';

beforeEach(() => {
  vi.stubEnv('AFFIC_API_KEY', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('constructor', () => {
  it('accepts an explicit API key', () => {
    const client = new Affic({ apiKey: API_KEY });

    expect(client.baseURL).toBe(DEFAULT_BASE_URL);
    expect(client.timeout).toBe(DEFAULT_TIMEOUT);
  });

  it('falls back to AFFIC_API_KEY', async () => {
    vi.stubEnv('AFFIC_API_KEY', API_KEY);
    const stub = fetchStub(noContent());

    await new Affic({ fetch: stub.fetch }).activity.create({ name: 'signup' });

    expect(stub.lastHeaders()['x-api-key']).toBe(API_KEY);
  });

  it.each([
    ['no key anywhere', {}],
    ['an empty key', { apiKey: '' }],
    ['a whitespace-only key', { apiKey: '   ' }],
  ])('throws AfficConfigurationError with %s', (_label, options) => {
    expect(() => new Affic(options)).toThrow(AfficConfigurationError);
    expect(() => new Affic(options)).toThrow(/AFFIC_API_KEY/);
  });

  it('rejects a non-absolute baseURL', () => {
    expect(() => new Affic({ apiKey: API_KEY, baseURL: '/api' })).toThrow(AfficConfigurationError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the invalid timeout %s',
    (timeout) => {
      expect(() => new Affic({ apiKey: API_KEY, timeout })).toThrow(AfficConfigurationError);
    },
  );

  it('strips trailing slashes from baseURL', async () => {
    const stub = fetchStub(noContent());
    const client = new Affic({
      apiKey: API_KEY,
      baseURL: 'https://staging.example.com//',
      fetch: stub.fetch,
    });

    await client.activity.create({ name: 'signup' });

    expect(client.baseURL).toBe('https://staging.example.com');
    expect(stub.lastCall().url).toBe(`https://staging.example.com${ACTIVITY_PATH}`);
  });

  it('refuses to construct in a browser-like environment', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});

    expect(() => new Affic({ apiKey: API_KEY })).toThrow(AfficConfigurationError);
    expect(() => new Affic({ apiKey: API_KEY })).toThrow(/server-only/);
  });
});

describe('request headers', () => {
  it('sends authentication, content negotiation, and a descriptive user-agent', async () => {
    const stub = fetchStub(noContent());

    await new Affic({ apiKey: API_KEY, fetch: stub.fetch }).activity.create({ name: 'signup' });

    const headers = stub.lastHeaders();
    expect(headers['x-api-key']).toBe(API_KEY);
    expect(headers['content-type']).toBe('application/json');
    expect(headers['accept']).toBe('application/json');
    expect(headers['user-agent']).toBe(`affic-sdk-node/${VERSION} node/${process.versions.node}`);
  });

  it('merges defaultHeaders and lower-cases their names', async () => {
    const stub = fetchStub(noContent());
    const client = new Affic({
      apiKey: API_KEY,
      fetch: stub.fetch,
      defaultHeaders: { 'X-Trace-Id': 'trace-1' },
    });

    await client.activity.create({ name: 'signup' });

    expect(stub.lastHeaders()['x-trace-id']).toBe('trace-1');
  });

  it('lets per-request headers win over defaults', async () => {
    const stub = fetchStub(noContent());
    const client = new Affic({
      apiKey: API_KEY,
      fetch: stub.fetch,
      defaultHeaders: { 'x-trace-id': 'trace-1' },
    });

    await client.activity.create({ name: 'signup' }, { headers: { 'X-Trace-Id': 'trace-2' } });

    expect(stub.lastHeaders()['x-trace-id']).toBe('trace-2');
  });
});

describe('error responses', () => {
  it('maps 401 to AfficAuthenticationError and keeps the codes and headers', async () => {
    const stub = fetchStub(
      errorResponse(401, ['INTEGRATION_NOT_FOUND'], 'Unauthorized', { 'x-request-id': 'req_1' }),
    );
    const client = new Affic({ apiKey: API_KEY, fetch: stub.fetch });

    await expect(client.activity.create({ name: 'signup' })).rejects.toThrow(
      AfficAuthenticationError,
    );

    const error = await client.activity.create({ name: 'signup' }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AfficAuthenticationError);
    expect((error as AfficAuthenticationError).codes).toEqual(['INTEGRATION_NOT_FOUND']);
    expect((error as AfficAuthenticationError).headers['x-request-id']).toBe('req_1');
  });

  it('maps 400 to AfficBadRequestError', async () => {
    const stub = fetchStub(errorResponse(400, ['name should not be empty'], 'Bad Request'));
    const client = new Affic({ apiKey: API_KEY, fetch: stub.fetch });

    await expect(client.activity.create({ name: 'signup' })).rejects.toThrow(AfficBadRequestError);
  });

  it('maps 500 to AfficInternalServerError', async () => {
    const stub = fetchStub(errorResponse(500, ['INTERNAL_ERROR'], 'Internal Server Error'));
    const client = new Affic({ apiKey: API_KEY, fetch: stub.fetch });

    await expect(client.activity.create({ name: 'signup' })).rejects.toThrow(
      AfficInternalServerError,
    );
  });

  it('survives an unreadable error body', async () => {
    const unreadable: FetchLike = () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('stream broke'));
            },
          }),
          { status: 500 },
        ),
      );
    const client = new Affic({ apiKey: API_KEY, fetch: unreadable });

    await expect(client.activity.create({ name: 'signup' })).rejects.toThrow(
      AfficInternalServerError,
    );
  });

  it('does not retry — one call in, one call out', async () => {
    const stub = fetchStub(errorResponse(500, ['INTERNAL_ERROR'], 'Internal Server Error'));
    const client = new Affic({ apiKey: API_KEY, fetch: stub.fetch });

    await expect(client.activity.create({ name: 'signup' })).rejects.toThrow(
      AfficInternalServerError,
    );
    expect(stub.calls).toHaveLength(1);
  });
});

describe('transport failures', () => {
  it('wraps a network failure in AfficConnectionError and keeps the cause', async () => {
    const cause = new TypeError('fetch failed');
    const failing: FetchLike = () => Promise.reject(cause);
    const client = new Affic({ apiKey: API_KEY, fetch: failing });

    const error = await client.activity
      .create({ name: 'signup' })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AfficConnectionError);
    expect((error as AfficConnectionError).cause).toBe(cause);
    expect((error as AfficConnectionError).message).toContain('fetch failed');
  });

  it('throws AfficTimeoutError once the timeout elapses', async () => {
    vi.useFakeTimers();
    const client = new Affic({ apiKey: API_KEY, fetch: hangingFetch(), timeout: 1_000 });

    const pending = client.activity.create({ name: 'signup' });
    const assertion = expect(pending).rejects.toThrow(AfficTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
  });

  it('reports the elapsed timeout on the error', async () => {
    vi.useFakeTimers();
    const client = new Affic({ apiKey: API_KEY, fetch: hangingFetch() });

    const pending = client.activity
      .create({ name: 'signup' }, { timeout: 5_000 })
      .catch((thrown: unknown) => thrown);
    await vi.advanceTimersByTimeAsync(5_000);

    const error = await pending;
    expect(error).toBeInstanceOf(AfficTimeoutError);
    expect((error as AfficTimeoutError).timeout).toBe(5_000);
  });

  it('honours a caller abort signal', async () => {
    const controller = new AbortController();
    const client = new Affic({ apiKey: API_KEY, fetch: hangingFetch() });

    const pending = client.activity
      .create({ name: 'signup' }, { signal: controller.signal })
      .catch((thrown: unknown) => thrown);
    controller.abort();

    const error = await pending;
    expect(error).toBeInstanceOf(AfficConnectionError);
    expect(error).not.toBeInstanceOf(AfficTimeoutError);
    expect((error as AfficConnectionError).message).toContain('aborted by the caller');
  });

  it('never opens a connection for an already-aborted signal', async () => {
    const stub = fetchStub(noContent());
    const client = new Affic({ apiKey: API_KEY, fetch: stub.fetch });

    const error = await client.activity
      .create({ name: 'signup' }, { signal: AbortSignal.abort() })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AfficConnectionError);
    expect((error as AfficConnectionError).message).toContain('before it started');
    expect(stub.calls).toHaveLength(0);
  });

  it('clears the timeout once a request settles', async () => {
    vi.useFakeTimers();
    const stub = fetchStub(noContent());
    const client = new Affic({ apiKey: API_KEY, fetch: stub.fetch, timeout: 1_000 });

    await client.activity.create({ name: 'signup' });
    await vi.advanceTimersByTimeAsync(5_000);

    expect(vi.getTimerCount()).toBe(0);
  });
});
