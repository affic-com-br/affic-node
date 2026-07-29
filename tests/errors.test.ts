import { describe, expect, it } from 'vitest';

import {
  AfficAPIError,
  AfficAuthenticationError,
  AfficBadRequestError,
  AfficConfigurationError,
  AfficConnectionError,
  AfficError,
  AfficInternalServerError,
  AfficNotFoundError,
  AfficTimeoutError,
} from '../src/errors.js';

const NO_HEADERS: Readonly<Record<string, string>> = {};

function envelope(statusCode: number, message: string[], error: string): string {
  return JSON.stringify({ statusCode, message, error });
}

describe('AfficError', () => {
  it('carries the concrete class name so logs stay readable', () => {
    expect(new AfficError('boom').name).toBe('AfficError');
    expect(new AfficConfigurationError('boom').name).toBe('AfficConfigurationError');
    expect(new AfficConnectionError('boom').name).toBe('AfficConnectionError');
  });

  it('preserves the cause', () => {
    const cause = new Error('socket hang up');

    expect(new AfficConnectionError('failed', { cause }).cause).toBe(cause);
  });

  it('is instanceof Error', () => {
    expect(new AfficError('boom')).toBeInstanceOf(Error);
  });
});

describe('AfficAPIError.from', () => {
  it('maps 400 to AfficBadRequestError', () => {
    const error = AfficAPIError.from(
      400,
      envelope(400, ['name should not be empty'], 'Bad Request'),
      NO_HEADERS,
    );

    expect(error).toBeInstanceOf(AfficBadRequestError);
    expect(error.status).toBe(400);
    expect(error.codes).toEqual(['name should not be empty']);
    expect(error.error).toBe('Bad Request');
  });

  it('maps 401 to AfficAuthenticationError', () => {
    const error = AfficAPIError.from(
      401,
      envelope(401, ['INTEGRATION_NOT_FOUND'], 'Unauthorized'),
      NO_HEADERS,
    );

    expect(error).toBeInstanceOf(AfficAuthenticationError);
    expect(error.codes).toEqual(['INTEGRATION_NOT_FOUND']);
    expect(error.message).toBe('Affic API error (status 401): INTEGRATION_NOT_FOUND');
  });

  it('maps 404 to AfficNotFoundError', () => {
    const error = AfficAPIError.from(
      404,
      envelope(404, ['TRACK_NOT_FOUND'], 'Not Found'),
      NO_HEADERS,
    );

    expect(error).toBeInstanceOf(AfficNotFoundError);
    expect(error.status).toBe(404);
    expect(error.codes).toEqual(['TRACK_NOT_FOUND']);
    expect(error.message).toBe('Affic API error (status 404): TRACK_NOT_FOUND');
  });

  it.each([500, 502, 503])('maps %i to AfficInternalServerError', (status) => {
    const error = AfficAPIError.from(status, '', NO_HEADERS);

    expect(error).toBeInstanceOf(AfficInternalServerError);
    expect(error.status).toBe(status);
  });

  it('falls back to AfficAPIError for undocumented statuses', () => {
    const error = AfficAPIError.from(429, '', NO_HEADERS);

    expect(error).toBeInstanceOf(AfficAPIError);
    expect(error).not.toBeInstanceOf(AfficBadRequestError);
    expect(error).not.toBeInstanceOf(AfficNotFoundError);
    expect(error).not.toBeInstanceOf(AfficInternalServerError);
    expect(error.message).toBe('Affic API error (status 429)');
  });

  it('degrades gracefully when the body is not the documented envelope', () => {
    const error = AfficAPIError.from(502, '  <html>Bad Gateway</html>  ', NO_HEADERS);

    expect(error.codes).toEqual([]);
    expect(error.error).toBe('<html>Bad Gateway</html>');
    expect(error.message).toBe('Affic API error (status 502): <html>Bad Gateway</html>');
  });

  it('joins several codes into the message', () => {
    const error = AfficAPIError.from(
      400,
      envelope(400, ['name should not be empty', 'value must be a number'], 'Bad Request'),
      NO_HEADERS,
    );

    expect(error.message).toBe(
      'Affic API error (status 400): name should not be empty, value must be a number',
    );
  });

  it('exposes the response headers', () => {
    const error = AfficAPIError.from(401, '', { 'x-request-id': 'req_123' });

    expect(error.headers).toEqual({ 'x-request-id': 'req_123' });
  });

  it('is catchable as AfficError', () => {
    expect(AfficAPIError.from(401, '', NO_HEADERS)).toBeInstanceOf(AfficError);
  });
});

describe('AfficTimeoutError', () => {
  it('reports the elapsed timeout and is catchable as a connection error', () => {
    const error = new AfficTimeoutError('timed out', 60_000);

    expect(error.timeout).toBe(60_000);
    expect(error).toBeInstanceOf(AfficConnectionError);
    expect(error.name).toBe('AfficTimeoutError');
  });
});
