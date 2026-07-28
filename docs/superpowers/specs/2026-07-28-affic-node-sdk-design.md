# Design: `@affic/sdk`, the Affic Node SDK

Date: 2026-07-28
Status: implemented

## Problem

`affic.com.br` exposes a server-to-server integration API for partners to report affiliate
activities. Integrators hand-roll the HTTP call, the `x-api-key` header, and the error parsing, and
each of them gets the retry semantics subtly wrong. This repository holds the official SDK.

## Scope

One endpoint: `POST /api/v1/integration-api/activity`. Everything else is out of scope until the
API grows, but the structure must absorb new resources without a redesign.

Target developer experience:

```ts
const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });

await client.activity.create({ name: 'purchase', value: 149.9 });
```

## API facts that shaped the design

From the OpenAPI document:

- Auth is a single `x-api-key` header. It identifies the integration, and through it the program —
  so no account id appears in any request body.
- Success is `204` with no body. There is nothing to deserialize on the happy path.
- Errors share one envelope: `{ statusCode: number, message: string[], error: string }`. `message`
  holds machine-readable codes or validation strings, and is always an array.
- The endpoint is **not idempotent**: every accepted call creates an activity.
- Amounts are decimal numbers in the domain default currency, never cents and never strings.

## Decisions

| Decision                     | Rationale                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Package `@affic/sdk`, scoped | Matches `@anthropic-ai/sdk` and friends, protects the name, leaves room for future `@affic/*` packages.                  |
| Zero runtime dependencies    | Node 20+ has `fetch`, `AbortController`, and `URL`. Every dependency is a supply-chain liability in someone's backend.   |
| Dual ESM + CJS via tsup      | Backends still `require()`. One devDependency produces both plus `.d.ts` for each.                                       |
| **No automatic retries**     | The endpoint is not idempotent; a transparent retry after a timeout can double-count a sale. Retrying is the caller's.   |
| Timeout, default 60s         | A server SDK with no timeout can hang a request forever. Ten lines, and it removes a whole class of production incident. |
| `client.<resource>.<verb>()` | The shape every major SDK uses. A new resource is a new file plus one field, not a refactor.                             |
| Typed error hierarchy        | Consumers branch on classes and on `codes`, never on message prose, which is not part of the contract.                   |
| Changesets for releases      | Keeps one human checkpoint — the "Version Packages" PR — in front of every permanent publish.                            |

## Architecture

```
src/
  index.ts            public barrel
  client.ts           Affic: option resolution, headers, request pipeline
  errors.ts           error hierarchy + status → class mapping
  types.ts            shared public types
  resources/
    activity.ts       activity.create()
  internal/
    fetch.ts          one HTTP call: timeout, abort, transport errors
    parse.ts          the only untyped-JSON boundary
    env.ts            environment probes
    request.ts        the interface resources depend on
    version.ts        build-time injected version
```

Flow: `client.activity.create(params)` validates the params, builds the JSON body, and calls
`RequestExecutor.post`. The client resolves headers and timeout, and `internal/fetch` composes the
caller's abort signal with the timeout, performs the call, and translates transport failures.
Non-2xx responses go through `internal/parse` and `AfficAPIError.from`, which never throws while
building an error: an unparseable body degrades to empty `codes` and the raw text.

Resources depend on the narrow `RequestExecutor` interface rather than on `Affic`, which keeps the
module graph acyclic and the resources trivially testable.

### Error hierarchy

```
AfficError
├─ AfficConfigurationError      no key, bad baseURL/timeout, browser detected
├─ AfficInvalidArgumentError    empty name, non-finite value — no request is sent
├─ AfficAPIError                non-2xx: status, codes, error, headers
│  ├─ AfficBadRequestError      400
│  ├─ AfficAuthenticationError  401
│  └─ AfficInternalServerError  5xx — safe to retry, nothing was recorded
└─ AfficConnectionError         never reached the API, or aborted
   └─ AfficTimeoutError         the configured timeout elapsed
```

### Typing discipline

The public surface has no `any` and no `unknown`. The single internal exception is
`internal/parse.ts`, where `JSON.parse` returns `any` and the value is immediately widened to
`unknown` and narrowed through hand-written type guards — the type-safe idiom; forbidding `unknown`
there would force `any`, which is worse.

tsconfig runs `strict` plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and
`verbatimModuleSyntax`, with `lib: ["ES2023"]` and no `DOM`.

### Node-only enforcement

Four independent layers, because one is a suggestion:

1. No `DOM` lib; ESLint bans browser globals.
2. `package.json` has `engines.node >= 20`, `"browser": false`, and no browser export condition.
3. The constructor throws `AfficConfigurationError` when `window` and `document` both exist. There
   is no `dangerouslyAllowBrowser` escape hatch: the token is program-level, so there is no
   legitimate browser use.
4. The README says so plainly.

## Testing

Vitest, with `fetch` injected through `ClientOptions.fetch` — no network, no mocking library.
Coverage thresholds at 90%; the suite reaches 100% of statements. Type tests
(`tests/types.test-d.ts`) assert the shape of the public API, including cases that must _not_
compile.

`npm run test:smoke` packs the tarball, installs it into a throwaway project, and drives it from
ESM, CommonJS, and `tsc --module node16` against a local stub server. That is the only check that
sees what consumers actually get.

## Delivery

- CI on every PR: lint + format, typecheck, tests on Node 20/22/24, package validation
  (publint, are-the-types-wrong, smoke test, `npm audit --omit=dev`), and a changeset presence gate.
- Release on merge to `main`: Changesets opens a "Version Packages" PR; merging it publishes with
  provenance, pushes `v<version>`, and creates the GitHub Release.
- CodeQL weekly and on PRs. Dependabot weekly for npm and Actions.

Manual setup — npm org, trusted publishing, branch rules — is documented in `docs/PUBLISHING.md`.
Release mechanics are in `docs/RELEASING.md`.

## Deliberately not built

Streaming, pagination, request IDs, `withResponse` variants, idempotency keys, and a retry policy.
The API is one non-idempotent endpoint returning `204`; all of that would be dead weight to
maintain and to document. Add them when an endpoint needs them.
