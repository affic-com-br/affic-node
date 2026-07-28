# Publishing to npm

Everything in this file is done once, by hand, by someone with owner rights on the npm org and
admin rights on the GitHub repo. After that, releases are automated — see
[RELEASING.md](./RELEASING.md).

## 1. Create the npm organization

The package is published as `@affic/sdk`, a scoped package, so the `affic` scope has to exist and
be owned by you.

1. Sign in at [npmjs.com](https://www.npmjs.com) with the account that should own the package.
2. Enable two-factor authentication on that account (**Account → Two-factor authentication**). npm
   requires it for publishing, and it is the only thing standing between a phished password and
   your package.
3. Create the org at <https://www.npmjs.com/org/create>, named `affic`, on the **free** plan
   (public packages only — which is what this is).
4. Invite the other maintainers as **owners** or **members** of the org. Do not rely on a single
   personal account: if it is lost, so is the package.

Check the name is free before anything else:

```bash
npm view @affic/sdk
# "npm error 404 ... is not in this registry" means it is available.
```

## 2. Choose how CI authenticates to npm

Two options. Prefer the first.

### Option A — Trusted publishing (OIDC), recommended

GitHub Actions proves its identity to npm directly. No token exists, so no token can leak, and npm
attaches a provenance statement automatically.

Requirements: npm CLI 11.5.1 or newer (the release workflow installs it), and the workflow must run
with `id-token: write` (it does).

1. Publish version `0.1.0` manually first (step 3) — trusted publishing can only be configured on a
   package that already exists.
2. On the package page, go to **Settings → Trusted publishers → Add publisher**.
3. Fill in:
   - Publisher: **GitHub Actions**
   - Organization or user: `affic-com-br`
   - Repository: `affic-node`
   - Workflow filename: `release.yml`
   - Environment: leave empty
4. Delete the `NPM_TOKEN` secret from the repo once the first automated release succeeds. The
   workflow reads it only as a fallback.

### Option B — Granular access token

Use only if trusted publishing is unavailable.

1. **Account → Access Tokens → Generate New Token → Granular Access Token**.
2. Scope it to **packages and scopes: `@affic/*`**, permission **Read and write**, expiry 90 days or
   less, and restrict it to no other org.
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, named
   `NPM_TOKEN`.
4. Put the expiry date in a calendar. An expired token fails a release at the worst possible moment.

## 3. The first publish

The first version goes out by hand so the package exists, so its ownership is unambiguous, and so
you see exactly what lands on the registry.

```bash
git clone https://github.com/affic-com-br/affic-node.git
cd affic-node
npm ci

npm run lint && npm run typecheck && npm run test:coverage
npm run check:package   # build + publint + are-the-types-wrong
npm run test:smoke      # installs the tarball and uses it from ESM, CJS, and tsc

npm pack --dry-run      # confirm only dist/, README.md, LICENSE, package.json ship

npm login               # if you are not already authenticated
npm publish --access public --provenance
```

`--access public` is required for the _first_ publish of a scoped package; without it npm assumes
private and rejects the publish on a free plan. Later publishes inherit it from
`publishConfig.access` in `package.json`.

Verify:

```bash
npm view @affic/sdk
npm view @affic/sdk dist-tags   # latest: 0.1.0
```

## 4. GitHub repository settings

These cannot be committed as files — set them in the repo UI.

**Settings → Actions → General**

- Workflow permissions: **Read repository contents and packages permissions** (each workflow already
  requests exactly what it needs).
- Check **Allow GitHub Actions to create and approve pull requests** — without it, the release
  workflow cannot open the "Version Packages" PR.

**Settings → Rules → Rulesets → New branch ruleset** targeting `main`:

- Require a pull request before merging, with at least 1 approval.
- Require status checks to pass: `Lint and format`, `Typecheck`, `Test on Node 20`,
  `Test on Node 22`, `Test on Node 24`, `Package`, `Changeset present`.
- Require branches to be up to date before merging.
- Block force pushes, and require linear history.
- Under bypass, allow the `github-actions[bot]` app so the release workflow can push the version
  commit and tags.

**Settings → Code security**

- Enable Dependabot alerts and security updates (`.github/dependabot.yml` handles version updates).
- Enable private vulnerability reporting, which `SECURITY.md` points contributors to.

**`.github/CODEOWNERS`** names `@CaioRolla`. Add more maintainers there as the team grows — a
single code owner means reviews stall whenever that person is away.

## 5. Ongoing hygiene

- Keep at least two npm org owners.
- Never run `npm publish` from a laptop again after step 3 — releases go through CI so every
  published artifact has provenance and a matching git tag.
- If a token or key is ever exposed, rotate it first and investigate second.
