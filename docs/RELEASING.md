# Releasing: tags, releases, and deployments

The short version: **you never bump a version, write a changelog, create a tag, or run
`npm publish`.** You describe the change; merging does the rest.

## The model

There are three artifacts, and each is produced by the one before it:

| Artifact         | Produced by                    | Produced from                   |
| ---------------- | ------------------------------ | ------------------------------- |
| A changeset file | you, in the feature PR         | your description of the change  |
| A version + tag  | the release workflow, on merge | the accumulated changeset files |
| An npm release   | the release workflow, on merge | the versioned commit            |

A tag is therefore never something you push. It is a receipt: `v0.2.0` exists _because_ `0.2.0` was
published, and it points at the exact commit that was built.

## Everyday flow

### 1. Describe the change in your PR

```bash
npx changeset
```

It asks for the bump type and a one-line summary, then writes a small markdown file under
`.changeset/`. Commit it with your code.

Choose the bump by what a consumer experiences:

- **patch** — a bug fix, better error message, or docs; existing code keeps working unchanged.
- **minor** — new capability, such as a new resource or an optional option.
- **major** — existing code must change: a removed export, a renamed field, a stricter type, or a
  different runtime behaviour for the same call.

CI fails the PR if it touches the package without a changeset. A docs-only or CI-only PR needs
none — say so in the PR checklist.

### 2. Merge to `main`

The release workflow runs, finds pending changesets, and opens (or updates) a PR titled
**"Version Packages"**. That PR contains only mechanical edits: the bumped `version` in
`package.json`, the new `CHANGELOG.md` section, and the deletion of the consumed changeset files.

Nothing is published yet. Several feature PRs can land while that PR sits open; it keeps updating.

### 3. Merge the "Version Packages" PR

That merge is the release. The workflow re-runs lint, typecheck, and tests against the exact
commit, then:

1. builds the package,
2. publishes to npm with provenance,
3. pushes the tag `v<version>`,
4. creates the GitHub Release from the changelog section.

Confirm with `npm view @affic/sdk dist-tags`.

## Versioning policy

Semver, with the pre-1.0 caveat spelled out:

- **While the version is `0.x`**, breaking changes bump the _minor_ (`0.1.0` → `0.2.0`) and
  everything else bumps the patch. Consumers should pin with `~0.2.0`, not `^0.2.0`.
- **From `1.0.0` on**, standard semver. Adding a resource or an optional option is a minor; removing
  or renaming anything exported, or changing what an existing call does, is a major.

Types are part of the contract. A change that makes previously valid consumer code fail to compile
is a breaking change, even when the runtime behaviour is identical.

Go to `1.0.0` when the API surface has been stable across a few releases and you are prepared to
support it. That is a deliberate decision, made with `npx changeset` and a major bump — not
something that should happen by accident.

## Prereleases

To publish under the `next` dist-tag without moving `latest`:

```bash
npx changeset pre enter next   # commit the result
# merge PRs as usual; each release publishes 0.3.0-next.0, -next.1, …
npx changeset pre exit         # commit; the next release is the real 0.3.0
```

Consumers opt in with `npm install @affic/sdk@next`.

## Hotfix on an older version

Only needed when `main` has already moved past the version that needs fixing.

1. Branch from the tag: `git switch -c hotfix/0.2.1 v0.2.0`.
2. Fix, add a patch changeset, and open a PR against `main` if the fix belongs there too.
3. If the fix must ship without the rest of `main`, run the release from that branch by hand,
   following the manual steps in [PUBLISHING.md](./PUBLISHING.md), then merge the fix forward.

Prefer rolling forward. Branch releases skip the automation and are easy to get wrong.

## When something goes wrong

- **Never `npm unpublish`.** It breaks every install of that version. Publish a fix instead.
- To stop a bad version being installed by default, deprecate it and move the tag:
  ```bash
  npm deprecate @affic/sdk@0.3.0 "Broken build; use 0.3.1"
  npm dist-tag add @affic/sdk@0.2.1 latest
  ```
- If the workflow published to npm but failed before tagging, create the missing tag on the release
  commit by hand and re-run the release job. npm is the source of truth for what exists; git is the
  record of how it was built.

## Why not automatic releases on every merge?

Every publish is permanent and, for an SDK, other people's production dependency. The "Version
Packages" PR is the one human checkpoint: someone reads the assembled changelog and decides that
this is a version worth other people upgrading to.
