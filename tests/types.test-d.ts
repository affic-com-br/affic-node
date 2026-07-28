import { describe, expectTypeOf, it } from 'vitest';

import {
  Affic,
  type Activity,
  type ActivityCreateParams,
  type ClientOptions,
  type FetchLike,
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

  it('allows a nullable affiliate id and an optional numeric value', () => {
    expectTypeOf<ActivityCreateParams['affiliateAccountId']>().toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf<ActivityCreateParams['value']>().toEqualTypeOf<number | undefined>();
  });

  it('rejects unknown fields and wrong types', () => {
    // @ts-expect-error `value` is a decimal number, never a string.
    expectTypeOf({ name: 'purchase', value: '149.9' }).toExtend<ActivityCreateParams>();
    // @ts-expect-error `name` is required.
    expectTypeOf({ value: 149.9 }).toExtend<ActivityCreateParams>();
  });

  it('accepts the global fetch as a FetchLike', () => {
    expectTypeOf(globalThis.fetch).toExtend<FetchLike>();
  });

  it('makes every client option optional', () => {
    expectTypeOf({}).toExtend<ClientOptions>();
    expectTypeOf<ClientOptions['timeout']>().toEqualTypeOf<number | undefined>();
  });

  it('takes an abort signal per request', () => {
    expectTypeOf<RequestOptions['signal']>().toEqualTypeOf<AbortSignal | undefined>();
  });

  it('exposes readonly client state', () => {
    expectTypeOf(client.baseURL).toBeString();
    expectTypeOf(client.timeout).toBeNumber();
  });
});
