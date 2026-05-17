# Contributing to @sigrea/core

Thank you for contributing! This project uses a PR-based workflow with required CI checks.

## Requirements

Node.js >= 24 and pnpm >= 10.
TypeScript strict mode, Biome for formatting, Vitest for tests.

## Scripts

`pnpm typecheck` — run TypeScript checks
`pnpm test` — run unit tests
`pnpm build` — build the library via unbuild
`pnpm format` — check formatting (no writes)
`pnpm format:fix` — apply formatting
`pnpm -s cicheck` — run test, typecheck, build, smoke, and format checks

## Commit Convention

Conventional Commits are required. Examples: `feat: ...`, `fix(scope): ...`, `docs: ...`.
The main branch uses squash merges, so the PR title becomes the final commit message.

## Changelog Entries

Changelogen reads Conventional Commits directly, so please keep commit messages descriptive. Any user-facing change (features, fixes, deprecations, breaking updates) should have a clear `feat`, `fix`, or similar commit. Non-user-facing changes can use `chore`, `test`, etc. For PRs that squash multiple commits, summarize the user impact in the PR description so release managers can double-check the changelog entry.

## Pull Requests

Ensure the following before requesting review:
`pnpm -s cicheck` passes and the PR title follows Conventional Commits.

## Release Workflow

This repository uses [changelogen](https://github.com/unjs/changelogen) to update `CHANGELOG.md` and create the release commit plus tag. Releases use an explicit version so maintainers do not depend on an inferred bump.

1. Ensure `main` is up to date and clean. Run `mise run notes` if you want to preview the generated notes without touching the tree.
2. Run `SIGREA_RELEASE_VERSION=x.y.z mise run release_version`. This runs `pnpm -s cicheck`, updates the changelog, amends the release commit if formatting changes are needed, and creates the annotated `vX.Y.Z` tag.
3. Push the commit and tag together with `mise run push_release`. The task uses `git push origin main --follow-tags`.
4. Tag pushes trigger `.github/workflows/publish.yml`. The job runs on the `release` environment, installs dependencies, runs `pnpm -s cicheck`, publishes to npm with OIDC trusted publishing, and then syncs the GitHub Release body with `pnpm exec changelogen gh release`.

If the publish workflow fails, fix the root cause and re-run the job from the GitHub Actions UI. Avoid creating a new tag unless you intend to cut a new release. If you must roll back, delete the tag locally and remotely, revert the release commit, and start over from step 1.
