import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as sdk from '../src/index.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

describe('public entry point', () => {
  it('exports the client and its defaults', () => {
    expect(sdk.Affic).toBeTypeOf('function');
    expect(sdk.DEFAULT_BASE_URL).toBe('https://server.affic.com.br');
    expect(sdk.DEFAULT_TIMEOUT).toBe(60_000);
  });

  it('exports every error class, so consumers can branch on any of them', () => {
    expect(
      Object.keys(sdk)
        .filter((name) => name.startsWith('Affic'))
        .sort(),
    ).toEqual([
      'Affic',
      'AfficAPIError',
      'AfficAuthenticationError',
      'AfficBadRequestError',
      'AfficConfigurationError',
      'AfficConnectionError',
      'AfficError',
      'AfficInternalServerError',
      'AfficInvalidArgumentError',
      'AfficNotFoundError',
      'AfficTimeoutError',
    ]);
  });

  it('reports the package version', () => {
    expect(sdk.VERSION).toBe(packageJson.version);
  });
});
