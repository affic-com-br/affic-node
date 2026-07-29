import { describe, expect, it } from 'vitest';

import { Affic } from '../src/client.js';
import { AfficInvalidArgumentError } from '../src/errors.js';

import { fetchStub, noContent } from './helpers/fetch-stub.js';

const API_KEY = 'sk_test_123';
const TRACK_ID = 'V1StGXR8_Z5j';

/** A `data` payload whose JSON is exactly `size` bytes: `{"note":"…"}` costs 11 bytes of syntax. */
function dataOfJsonSize(size: number): { note: string } {
  return { note: 'a'.repeat(size - 11) };
}

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

  it('forwards the track id verbatim', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({
      name: 'purchase',
      value: 149.9,
      trackId: TRACK_ID,
    });

    expect(stub.lastBody()).toEqual({
      name: 'purchase',
      value: 149.9,
      trackId: TRACK_ID,
    });
  });

  it('sends an explicit null track id for unattributed activities', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'purchase', value: 149.9, trackId: null });

    expect(stub.lastBody()).toEqual({ name: 'purchase', value: 149.9, trackId: null });
  });

  it('omits value entirely for non-monetary activities', async () => {
    const { client, stub } = clientWithStub();

    await client.activity.create({ name: 'signup', trackId: TRACK_ID });

    expect(stub.lastBody()).toEqual({ name: 'signup', trackId: TRACK_ID });
  });

  it.each([
    ['an empty track id', ''],
    ['a track id of 11 characters', 'V1StGXR8_Z5'],
    ['a track id of 13 characters', 'V1StGXR8_Z5jj'],
    ['a track id with a character outside the url-safe alphabet', 'V1StGXR8_Z5!'],
  ])('rejects %s before any request is made', async (_label, trackId) => {
    const { client, stub } = clientWithStub();

    await expect(client.activity.create({ name: 'purchase', trackId })).rejects.toThrow(
      AfficInvalidArgumentError,
    );
    expect(stub.calls).toHaveLength(0);
  });

  it('sends data as a nested object', async () => {
    const { client, stub } = clientWithStub();
    const data = { orderId: 'A-10293', items: 3, campaign: 'summer-sale' };

    await client.activity.create({ name: 'purchase', value: 149.9, trackId: TRACK_ID, data });

    expect(stub.lastBody()).toEqual({
      name: 'purchase',
      value: 149.9,
      trackId: TRACK_ID,
      data,
    });
  });

  it('accepts data serializing to exactly the 4096-byte limit', async () => {
    const { client, stub } = clientWithStub();
    const data = dataOfJsonSize(4096);

    await client.activity.create({ name: 'purchase', data });

    expect(stub.lastBody()).toEqual({ name: 'purchase', data });
  });

  it('rejects data serializing past the 4096-byte limit before any request is made', async () => {
    const { client, stub } = clientWithStub();

    await expect(
      client.activity.create({ name: 'purchase', data: dataOfJsonSize(4097) }),
    ).rejects.toThrow(AfficInvalidArgumentError);
    expect(stub.calls).toHaveLength(0);
  });

  it('measures the data limit in bytes, not characters', async () => {
    const { client, stub } = clientWithStub();

    // 'é' is two UTF-8 bytes but one character, so a payload under the limit by character count
    // can still exceed it on the wire.
    await expect(
      client.activity.create({ name: 'purchase', data: { note: 'é'.repeat(2100) } }),
    ).rejects.toThrow(AfficInvalidArgumentError);
    expect(stub.calls).toHaveLength(0);
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
