# Contributing to @sigrea/core

Thank you for contributing! This project uses a PR-based workflow with required CI checks.

## Requirements

Install [Vite+](https://viteplus.dev/guide/). Development uses Node.js 26.13.0
LTS and pnpm 12.16.1 from `.node-version` and `package.json`. Published packages
continue to support Node.js 24+.

```sh
vp env install
vp install --frozen-lockfile
```

The project uses TypeScript strict mode, Oxlint/Oxfmt, Vitest, and tsdown through
Vite+. The local CLI is also available as `pnpm exec vp` when using a separately
managed supported Node.js runtime.

## Scripts

- `vp check` — format, lint, and TypeScript checks
- `vp test run` — unit tests
- `vp test run --coverage` — V8 coverage with the existing thresholds
- `vp pack` — build the ESM/CJS library and declarations
- `vp fmt` — apply formatting
- `vp run cicheck` — run checks, tests, build, and package smoke checks

`vp install` installs the pre-commit dispatcher. The hook fixes staged source
files and runs the full test suite. Generated `.vite-hooks/_` files stay ignored.

## Commit Convention

Conventional Commits are required. Examples: `feat: ...`, `fix(scope): ...`, `docs: ...`.
The main branch uses squash merges, so the PR title becomes the final commit message.

## Changelog Entries

Changelogen reads Conventional Commits directly, so please keep commit messages descriptive. Any user-facing change (features, fixes, deprecations, breaking updates) should have a clear `feat`, `fix`, or similar commit. Non-user-facing changes can use `chore`, `test`, etc. For PRs that squash multiple commits, summarize the user impact in the PR description so release managers can double-check the changelog entry.

## Pull Requests

Ensure the following before requesting review:
`vp run cicheck` passes and the PR title follows Conventional Commits.

## Release Workflow

This repository uses [changelogen](https://github.com/unjs/changelogen) to update `CHANGELOG.md` and create the release commit plus tag. Releases use an explicit version so maintainers do not depend on an inferred bump.

1. Ensure `main` is up to date and clean. Run `vp run notes` if you want to preview the generated notes without touching the tree.
2. Run `SIGREA_RELEASE_VERSION=x.y.z vp run release_version`. This runs `vp run cicheck`, updates the changelog, amends the release commit if formatting changes are needed, and creates the annotated `vX.Y.Z` tag.
3. Push the commit and tag together with `vp run push_release`. The task uses `git push origin main --follow-tags`.
4. Tag pushes trigger `.github/workflows/publish.yml`. The job runs on the `release` environment, installs dependencies, runs `vp run cicheck`, packs a tarball with resolved pnpm catalogs, publishes it to npm with OIDC trusted publishing, and then syncs the GitHub Release body with `vp exec changelogen gh release`.

If the publish workflow fails, fix the root cause and re-run the job from the GitHub Actions UI. Avoid creating a new tag unless you intend to cut a new release. If you must roll back, delete the tag locally and remotely, revert the release commit, and start over from step 1.
