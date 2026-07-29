// Type-resolution check: a consumer compiling under `module: node16` must see the published
// types, with no `any` leaking out of the SDK.
import {
  Affic,
  AfficAuthenticationError,
  type ActivityCreateParams,
  type ClientOptions,
} from '@affic/sdk';

const options: ClientOptions = { apiKey: 'sk_test_123', timeout: 5_000 };
const client = new Affic(options);

const params: ActivityCreateParams = {
  name: 'purchase',
  value: 149.9,
  trackId: 'V1StGXR8_Z5j',
  data: { orderId: 'A-10293', items: 3 },
};

export async function report(): Promise<string> {
  try {
    const result: void = await client.activity.create(params);
    return String(result);
  } catch (error) {
    if (error instanceof AfficAuthenticationError) {
      const codes: readonly string[] = error.codes;
      return codes.join(',');
    }
    throw error;
  }
}
