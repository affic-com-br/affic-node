# Contributing

Thanks for helping improve the Affic Node SDK.

## Getting set up

```bash
git clone https://github.com/affic-com-br/affic-node.git
cd affic-node
npm ci
npm test
```

Node 20 or newer. `.nvmrc` pins the version CI uses for the non-matrix jobs.

## The commands

| Command                 | What it does                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| `npm test`              | Runs unit tests and the type tests                                |
| `npm run test:watch`    | Same, in watch mode                                               |
| `npm run test:coverage` | Adds coverage, enforcing the 90% thresholds                       |
| `npm run test:smoke`    | Packs the tarball and uses it from ESM, CommonJS, and `tsc`       |
| `npm run lint`          | ESLint, type-aware, zero warnings allowed                         |
| `npm run format`        | Prettier, writes                                                  |
| `npm run typecheck`     | `tsc --noEmit`                                                    |
| `npm run build`         | Builds `dist/` with tsup                                          |
| `npm run check:package` | Build, then publint and are-the-types-wrong on the packed tarball |

## House rules

**No runtime dependencies.** The SDK ships zero and should keep shipping zero. Node's built-ins
cover what an HTTP client needs. Open an issue before proposing one.

**No `any`, no `unknown` in the public surface.** Untyped JSON is narrowed once, in
`src/internal/parse.ts`, behind explicit type guards. Nothing else in the codebase should need to.

**Node only.** No DOM types, no browser globals, no `browser` export condition. The integration
token authenticates a whole program; shipping it to a browser is a security bug, and the client
throws if it detects one.

**No retries.** The activity endpoint is not idempotent, so a transparent retry can double-count a
sale. Timeouts and abort signals are supported; retrying is the caller's decision.

## Layout

```
src/
  index.ts            public exports — everything a consumer can import
  client.ts           the Affic class: options, headers, the request pipeline
  errors.ts           the error hierarchy and status → class mapping
  types.ts            shared public types
  resources/
    activity.ts       the activity resource
  internal/
    fetch.ts          one HTTP call, with timeout and abort handling
    parse.ts          the only place untyped JSON is touched
    env.ts            environment probes (API key, browser detection)
    request.ts        the interface resources depend on
    version.ts        build-time injected version
tests/                unit tests, plus type tests in *.test-d.ts
scripts/smoke/        consumers used by the smoke test
```

Adding a resource means: a file under `src/resources/`, a field on `Affic`, exports in `index.ts`,
tests, and README coverage. The request pipeline should not need to change.

## Tests

Write the test first, and make sure it fails for the right reason before you make it pass.

Tests never touch the network — they inject a `fetch` double through `ClientOptions.fetch`
(see `tests/helpers/fetch-stub.ts`). Cover the failure paths too: a well-tested SDK is mostly a
well-tested set of errors.

## Pull requests

1. Branch off `main`.
2. Make the change, with tests.
3. Run `npx changeset` and describe the change (see [docs/RELEASING.md](./docs/RELEASING.md) for how
   to pick the bump type). CI fails a package change with no changeset.
4. Make sure `npm run lint`, `npm run typecheck`, and `npm test` pass.
5. Open the PR and fill in the template.

Commit messages: imperative mood, explain why in the body when it is not obvious. The changelog
comes from your changeset, not from your commit messages, so write the changeset for consumers and
the commit for reviewers.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](./SECURITY.md).
