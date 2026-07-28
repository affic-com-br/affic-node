# @affic/sdk

Official Node.js SDK for the [Affic](https://affic.com.br) integration API.

- Zero runtime dependencies
- Typed end to end — no `any` in the public surface
- Server-only by design: the integration token never belongs in a browser

```ts
import { Affic } from '@affic/sdk';

const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });

await client.activity.create({
  name: 'purchase',
  value: 149.9,
  affiliateAccountId: '3f1c2a5e-9b47-4d1e-8a10-6c0f2d7b9e34',
});
```

A runnable version of this snippet lives in [`examples/01-basic.ts`](./examples/01-basic.ts).

## Requirements

Node.js 20 or newer. The SDK uses the built-in `fetch`, so nothing else is installed.

## Installation

```bash
npm install @affic/sdk
```

Works from ESM (`import`) and CommonJS (`require`).

## Authentication

Create an integration in the company area and copy its token. The token identifies the
integration, and through it the program and account an activity is recorded against — which is why
no account id appears anywhere in a request body.

Pass the token explicitly, or leave it out and the SDK reads `AFFIC_API_KEY`:

```ts
const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });
const sameClient = new Affic(); // reads AFFIC_API_KEY
```

> **The token is a secret.** It can write activities for your whole program. Keep it server-side,
> out of your repository, and rotate it in the company area if it leaks. Constructing the client in
> a browser throws `AfficConfigurationError`.

## Reporting activities

```ts
await client.activity.create({ name, value, affiliateAccountId });
```

The call resolves to `undefined` — the API answers `204` with no body, and the resulting commission
shows up in the affiliate area.

| Field                | Type             | Required | Notes                                                                         |
| -------------------- | ---------------- | -------- | ----------------------------------------------------------------------------- |
| `name`               | `string`         | yes      | Must match a configured metric name exactly, or no commission is computed.    |
| `value`              | `number`         | no       | Decimal in the domain default currency (`149.9`) — not cents, not a string.   |
| `affiliateAccountId` | `string \| null` | no       | Affiliate UUID to credit. `null` or omitted records an unattributed activity. |

### How the commission is computed

The `name` is matched against the metrics configured for your integration:

- **`FIXED` metric** — the configured amount is paid, whatever `value` holds.
- **`PERCENTAGE` metric** — the configured percentage of `value`. A missing `value` yields `0`.
- **No matching metric** — the activity is stored, but with no metric and no commission.

An unmatched name is _not_ an error, so keep these strings stable and identical to the configured
metric names.

### Common shapes

```ts
// A sale credited to a known affiliate.
await client.activity.create({
  name: 'purchase',
  value: 149.9,
  affiliateAccountId: '3f1c2a5e-9b47-4d1e-8a10-6c0f2d7b9e34',
});

// Recorded against the program only: no affiliate is credited, but it still counts for reporting.
await client.activity.create({ name: 'purchase', value: 149.9, affiliateAccountId: null });

// A non-monetary activity, for a FIXED metric such as a signup.
await client.activity.create({ name: 'signup' });
```

### This endpoint is not idempotent

Every accepted call creates one activity, so a retry after a network timeout can double-count a
sale. **The SDK never retries on your behalf.**

Retry only on `AfficInternalServerError` (`5xx`), where the API guarantees nothing was recorded:

```ts
import { AfficInternalServerError } from '@affic/sdk';

try {
  await client.activity.create({ name: 'purchase', value: 149.9 });
} catch (error) {
  if (error instanceof AfficInternalServerError) {
    // Nothing was recorded. Safe to try again.
  }
  throw error;
}
```

After a timeout or a connection failure, the outcome is unknowable — reconcile in the affiliate
area rather than retrying blindly.

## Configuration

```ts
const client = new Affic({
  apiKey: process.env['AFFIC_API_KEY'],
  baseURL: 'https://server.affic.com.br',
  timeout: 60_000,
  fetch: myInstrumentedFetch,
  defaultHeaders: { 'x-trace-id': traceId },
});
```

| Option           | Type                     | Default                       | Purpose                                               |
| ---------------- | ------------------------ | ----------------------------- | ----------------------------------------------------- |
| `apiKey`         | `string`                 | `process.env.AFFIC_API_KEY`   | Sent as the `x-api-key` header.                       |
| `baseURL`        | `string`                 | `https://server.affic.com.br` | Point at another environment.                         |
| `timeout`        | `number`                 | `60000`                       | Milliseconds before the request is aborted.           |
| `fetch`          | `FetchLike`              | global `fetch`                | Proxy agents, instrumentation, or test doubles.       |
| `defaultHeaders` | `Record<string, string>` | `{}`                          | Added to every request. Header names are lower-cased. |

Every call also takes per-request overrides:

```ts
const controller = new AbortController();

await client.activity.create(
  { name: 'purchase', value: 149.9 },
  { timeout: 5_000, signal: controller.signal, headers: { 'x-trace-id': traceId } },
);
```

## Error handling

Every error thrown by the SDK extends `AfficError`.

| Class                       | Thrown when                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `AfficConfigurationError`   | No API key, an invalid `baseURL` or `timeout`, or a browser detected. |
| `AfficInvalidArgumentError` | An empty `name` or a non-finite `value`. No request is sent.          |
| `AfficBadRequestError`      | `400` — the API rejected the payload.                                 |
| `AfficAuthenticationError`  | `401` — the key is missing or unknown (`INTEGRATION_NOT_FOUND`).      |
| `AfficInternalServerError`  | `5xx` — nothing was recorded; safe to retry.                          |
| `AfficAPIError`             | Any other non-2xx status. Base class of the three above.              |
| `AfficTimeoutError`         | The configured timeout elapsed.                                       |
| `AfficConnectionError`      | The request never reached the API, or you aborted it.                 |

`AfficAPIError` carries the details of the response:

```ts
import { AfficAPIError } from '@affic/sdk';

try {
  await client.activity.create({ name: 'purchase', value: 149.9 });
} catch (error) {
  if (error instanceof AfficAPIError) {
    error.status; // 401
    error.codes; // ['INTEGRATION_NOT_FOUND']
    error.error; // 'Unauthorized'
    error.headers; // { 'x-request-id': '…' }
  }
  throw error;
}
```

Branch on the error class and on `codes` — the message prose is not part of the API contract and
can change.

## Node-only

This SDK refuses to run in a browser, and it is not shipped with a browser build. The integration
token authenticates an entire program: anyone who reads it from a bundle can write activities
against your account. Call the API from your backend and let your frontend talk to your backend.

## TypeScript

Types ship with the package; nothing extra to install. `ActivityCreateParams`, `ClientOptions`,
`RequestOptions`, `FetchLike`, and the error classes are all exported.

`strict` mode is assumed. The public surface contains no `any` and no `unknown`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Release mechanics live in
[docs/RELEASING.md](./docs/RELEASING.md); first-time npm setup lives in
[docs/PUBLISHING.md](./docs/PUBLISHING.md).

## License

[MIT](./LICENSE)
