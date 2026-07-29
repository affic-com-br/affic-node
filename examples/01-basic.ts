/**
 * The whole SDK in eight lines: build a client, report an activity.
 *
 * The call resolves once the API confirms with `204`. There is no response body — the resulting
 * commission shows up in the affiliate area.
 */
import { Affic } from '@affic/sdk';

// With no `apiKey`, the client reads AFFIC_API_KEY from the environment.
const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });

// `trackId` is the `__affic` value your storefront received, kept by the tag in its attribution
// cookie. Forward it verbatim, or pass null when the sale cannot be attributed.
await client.activity.create({
  name: 'purchase',
  value: 149.9,
  trackId: 'V1StGXR8_Z5j',
  data: { orderId: 'A-10293', items: 3 },
});

console.log('Purchase recorded.');
