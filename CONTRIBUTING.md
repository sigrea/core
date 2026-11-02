# Contributing to @sigrea/core

## Development

Install [Vite+](https://viteplus.dev/guide/). Node.js and pnpm versions are set in
`.node-version` and `package.json`.

```sh
vp env install
vp install --frozen-lockfile
```

- `vp check` — formatting, lint, and TypeScript checks
- `vp test run` — tests
- `vp test run --coverage` — coverage
- `vp pack` — ESM/CJS bundles and declarations
- `vp fmt` — format source files
- `vp run cicheck` — checks, tests, packaging, and smoke checks

The pre-commit hook checks and fixes staged files. Run `vp run cicheck` before
opening a PR.

Use a Conventional Commit title, such as `fix: stop a watcher after disposal`.
The title becomes the squash commit message and is used to generate the changelog.
Mention any breaking changes, manual checks, or known issues in the PR description.

## Releasing

Releases use stable `x.y.z` versions. Start on a clean `main` matching `origin/main`:

```sh
vp run notes
SIGREA_RELEASE_VERSION=x.y.z vp run release_version
vp run push_release
```

`notes` previews the changelog. `release_version` runs the checks, updates the
version and CHANGELOG, then creates a commit and an annotated tag. The version
must be newer than the current version, and the tag must not already exist.

`push_release` asks before pushing main and the release tag together. If either
update fails, neither is pushed. It does not push other local tags.

The tag workflow publishes to npm using OIDC, then creates or updates the GitHub
Release from CHANGELOG with `gh`.

If preparation fails, check `git status` and `git log` before retrying. It may have
already changed the version or created a commit.

## Failed releases

Rerun a failed publish job on the same tag. If the version is already on npm, the
job skips npm publication and updates the GitHub Release.

If the tagged code needs changing, cut a new version. Do not move a tag that has
already been pushed. Published npm versions cannot be reused, even after
unpublishing.
