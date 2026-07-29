import { describe, expectTypeOf, it } from 'vitest';

import {
  Affic,
  type Activity,
  type ActivityCreateParams,
  type ClientOptions,
  type FetchLike,
  type JsonObject,
  type RequestOptions,
} from '../src/index.js';

describe('public types', () => {
  const client = new Affic({ apiKey: 'sk_test_123' });

  it('resolves activity.create to void', () => {
    expectTypeOf<ReturnType<Activity['create']>>().resolves.toBeVoid();
  });

  it('requires only a name', () => {
    expectTypeOf<ActivityCreateParams['name']>().toEqualTypeOf<string>();
    expectTypeOf({ name: 'signup' }).toExtend<ActivityCreateParams>();
  });

  it('allows a nullable track id and an optional numeric value', () => {
    expectTypeOf<ActivityCreateParams['trackId']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<ActivityCreateParams['value']>().toEqualTypeOf<number | undefined>();
  });

  it('no longer carries the affiliateAccountId the API replaced with trackId', () => {
    expectTypeOf<ActivityCreateParams>().toHaveProperty('trackId');
    expectTypeOf<ActivityCreateParams>().not.toHaveProperty('affiliateAccountId');
  });

  it('types the free-form data payload as JSON, never as any', () => {
    expectTypeOf<ActivityCreateParams['data']>().toEqualTypeOf<JsonObject | undefined>();
    expectTypeOf({
      name: 'purchase',
      data: { orderId: 'A-10293', items: 3, nested: { campaign: 'summer-sale' } },
    }).toExtend<ActivityCreateParams>();
  });

  it('rejects unknown fields and wrong types', () => {
    // @ts-expect-error `value` is a decimal number, never a string.
    expectTypeOf({ name: 'purchase', value: '149.9' }).toExtend<ActivityCreateParams>();
    // @ts-expect-error `name` is required.
    expectTypeOf({ value: 149.9 }).toExtend<ActivityCreateParams>();
    // @ts-expect-error `data` holds JSON, so a function is not assignable.
    expectTypeOf({ name: 'purchase', data: { cb: () => 1 } }).toExtend<ActivityCreateParams>();
  });

  it('accepts the global fetch as a FetchLike', () => {
    expectTypeOf(globalThis.fetch).toExtend<FetchLike>();
  });

  it('makes every client option optional', () => {
    expectTypeOf({}).toExtend<ClientOptions>();
    expectTypeOf<ClientOptions['timeout']>().toEqualTypeOf<number | undefined>();
  });

  it('accepts an API key read straight from the environment', () => {
    // `process.env[…]` is `string | undefined`. Under `exactOptionalPropertyTypes` that is only
    // assignable because the options are declared `?: T | undefined`. This is the documented
    // call, so it must keep compiling.
    const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });

    expectTypeOf(client).toEqualTypeOf<Affic>();
  });

  it('takes an abort signal per request', () => {
    expectTypeOf<RequestOptions['signal']>().toEqualTypeOf<AbortSignal | undefined>();
  });

  it('exposes readonly client state', () => {
    expectTypeOf(client.baseURL).toBeString();
    expectTypeOf(client.timeout).toBeNumber();
  });
});
