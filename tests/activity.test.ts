import { describe, expect, it } from 'vitest';

import { Affic } from '../src/client.js';
import { AfficInvalidArgumentError } from '../src/errors.js';

import { fetchStub, noContent } from './helpers/fetch-stub.js';

const API_KEY = 'sk_test_123';
const AFFILIATE_ID = '3f1c2a5e-9b47-4d1e-8a10-6c0f2d7b9e34';

function clientWithStub(): { client: Affic; stub: ReturnType<typeof fetchStub> } {
  const stub = fetchStub(noContent());

  return { client: new Affic({ apiKey: API_KEY, fetch: stub.fetch }), stub };
}

describe('activity.create', () => {
  it('posts to the activity endpoint', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'purchase', value: 149.9 });

    expect(stub.lastCall().url).toBe('https://server.affic.com.br/api/v1/integration-api/activity');
    expect(stub.lastCall().init.method).toBe('POST');
  });

  it('resolves to undefined on 204', async () => {
    const { client } = clientWithStub();

    await expect(
      client.activity.create({ name: 'purchase', value: 149.9 }),
    ).resolves.toBeUndefined();
  });

  it('sends an attributed purchase', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({
      name: 'purchase',
      value: 149.9,
      affiliateAccountId: AFFILIATE_ID,
    });

    expect(stub.lastBody()).toEqual({
      name: 'purchase',
      value: 149.9,
      affiliateAccountId: AFFILIATE_ID,
    });
  });

  it('sends an explicit null affiliate for unattributed activities', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'purchase', value: 149.9, affiliateAccountId: null });

    expect(stub.lastBody()).toEqual({ name: 'purchase', value: 149.9, affiliateAccountId: null });
  });

  it('omits value entirely for non-monetary activities', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'signup', affiliateAccountId: AFFILIATE_ID });

    expect(stub.lastBody()).toEqual({ name: 'signup', affiliateAccountId: AFFILIATE_ID });
  });

  it('keeps a zero value, which is meaningful for PERCENTAGE metrics', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'purchase', value: 0 });

    expect(stub.lastBody()).toEqual({ name: 'purchase', value: 0 });
  });

  it('sends amounts as decimal numbers, never strings', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'purchase', value: 149.9 });

    expect(stub.lastCall().init.body).toBe('{"name":"purchase","value":149.9}');
  });

  it.each([
    ['an empty name', ''],
    ['a whitespace-only name', '   '],
  ])('rejects %s before any request is made', async (_label, name) => {
    const { client, stub } = clientWithStub();

    await expect(client.activity.create({ name })).rejects.toThrow(AfficInvalidArgumentError);
    expect(stub.calls).toHaveLength(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects the non-finite value %s before any request is made',
    async (value) => {
      const { client, stub } = clientWithStub();

      await expect(client.activity.create({ name: 'purchase', value })).rejects.toThrow(
        AfficInvalidArgumentError,
      );
      expect(stub.calls).toHaveLength(0);
    },
  );

  it('forwards per-call request options', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'signup' }, { headers: { 'x-trace-id': 'trace-9' } });

    expect(stub.lastHeaders()['x-trace-id']).toBe('trace-9');
  });
});
