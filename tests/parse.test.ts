import { describe, expect, it } from 'vitest';

import { parseErrorEnvelope } from '../src/internal/parse.js';

describe('parseErrorEnvelope', () => {
  it('parses a well-formed envelope', () => {
    const body = JSON.stringify({
      statusCode: 401,
      message: ['INTEGRATION_NOT_FOUND'],
      error: 'Unauthorized',
    });

    expect(parseErrorEnvelope(body)).toEqual({
      statusCode: 401,
      message: ['INTEGRATION_NOT_FOUND'],
      error: 'Unauthorized',
    });
  });

  it('parses an envelope carrying several validation messages', () => {
    const body = JSON.stringify({
      statusCode: 400,
      message: ['name should not be empty', 'value must be a number'],
      error: 'Bad Request',
    });

    expect(parseErrorEnvelope(body)?.message).toEqual([
      'name should not be empty',
      'value must be a number',
    ]);
  });

  it.each([
    ['an empty body', ''],
    ['non-JSON text', '<html>502 Bad Gateway</html>'],
    ['a JSON array', '[1, 2, 3]'],
    ['a JSON primitive', '"nope"'],
    ['null', 'null'],
    ['a missing statusCode', JSON.stringify({ message: ['X'], error: 'Bad Request' })],
    ['a string message', JSON.stringify({ statusCode: 400, message: 'X', error: 'Bad Request' })],
    [
      'a message array holding non-strings',
      JSON.stringify({ statusCode: 400, message: ['X', 7], error: 'Bad Request' }),
    ],
    ['a missing error', JSON.stringify({ statusCode: 400, message: ['X'] })],
  ])('returns null for %s', (_label, body) => {
    expect(parseErrorEnvelope(body)).toBeNull();
  });

  it('ignores unknown extra fields', () => {
    const body = JSON.stringify({
      statusCode: 400,
      message: ['X'],
      error: 'Bad Request',
      traceId: 'abc',
    });

    expect(parseErrorEnvelope(body)).toEqual({
      statusCode: 400,
      message: ['X'],
      error: 'Bad Request',
    });
  });
});
