# Contributing to @sigrea/core

Thank you for contributing! This project uses a PR-based workflow with required CI checks.

## Requirements

Node.js >= 20 and pnpm >= 10.
TypeScript strict mode, Biome for formatting, Vitest for tests.

## Scripts

`pnpm typecheck` — run TypeScript checks
`pnpm test` — run unit tests
`pnpm build` — build the library via unbuild
`pnpm format` — check formatting (no writes)
`pnpm format:fix` — apply formatting

## Commit Convention

Conventional Commits are required. Examples: `feat: ...`, `fix(scope): ...`, `docs: ...`.

## Changelog Entries

Changelogen reads Conventional Commits directly, so please keep commit messages descriptive. Any user-facing change (features, fixes, deprecations, breaking updates) should have a clear `feat`, `fix`, or similar commit. Non-user-facing changes can use `chore`, `test`, etc. For PRs that squash multiple commits, summarize the user impact in the PR description so release managers can double-check the changelog entry.

## Pull Requests

Ensure the following before requesting review:
CI passes (typecheck/format/test-build) and the PR title follows Conventional Commits.
Summarize any user-facing change in the PR template so Changelogen output remains accurate.

On pull requests, compressed size checks (gzip/brotli) run against built artifacts.
If a significant size increase is reported, please consider API surface, tree-shaking, and dependency choices.

## Labels

Repository labels are synchronized automatically from `.github/labels.yml`.
You do not need to create labels manually.

## Release Workflow

This repository now uses [changelogen](https://github.com/unjs/changelogen) to infer the next semantic version from Conventional Commits, update `CHANGELOG.md`, and create the release commit plus tag. The workflow is intentionally linear so that a single maintainer can ship safely end to end.

1. Ensure `main` is up to date and clean. Run `pnpm changelog --no-output` if you want to preview the generated notes without touching the tree.
2. Execute `pnpm release`. This script runs `pnpm test`, `pnpm build`, and `changelogen --release` in sequence. The command bumps the version in `package.json`, rewrites `CHANGELOG.md`, and creates a `chore(release): vX.Y.Z` commit alongside the annotated `vX.Y.Z` tag.
3. Push the commit and tag together: `git push origin main --follow-tags`. If you need to stage multiple release commits, push in chronological order so tags stay in sync.
4. Tag pushes trigger `.github/workflows/publish.yml` automatically (the workflow also remains runnable via `workflow_dispatch` for recovery). The job runs on the `release` environment, installs dependencies, executes tests and build, publishes to npm with provenance plus GitHub Packages, backfills the tag if it is missing, and finally calls `pnpm dlx changelogen gh release vX.Y.Z --token $GITHUB_TOKEN` to sync the GitHub Release body with the freshly updated `CHANGELOG.md`.

If the publish workflow fails, fix the root cause, re-run it via `workflow_dispatch`, and avoid creating a new tag. If you must roll back, delete the tag locally and remotely, revert the release commit, and start over from step 1.
