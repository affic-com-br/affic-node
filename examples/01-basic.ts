/**
 * The whole SDK in eight lines: build a client, report an activity.
 *
 * The call resolves once the API confirms with `204`. There is no response body — the resulting
 * commission shows up in the affiliate area.
 */
import { Affic } from '@affic/sdk';

// With no `apiKey`, the client reads AFFIC_API_KEY from the environment.
const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });

await client.activity.create({
  name: 'purchase',
  value: 149.9,
  affiliateAccountId: '3f1c2a5e-9b47-4d1e-8a10-6c0f2d7b9e34',
});

console.log('Purchase recorded.');
