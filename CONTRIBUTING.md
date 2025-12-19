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
The main branch uses squash merges, so the PR title becomes the final commit message.

## Changelog Entries

Changelogen reads Conventional Commits directly, so please keep commit messages descriptive. Any user-facing change (features, fixes, deprecations, breaking updates) should have a clear `feat`, `fix`, or similar commit. Non-user-facing changes can use `chore`, `test`, etc. For PRs that squash multiple commits, summarize the user impact in the PR description so release managers can double-check the changelog entry.

## Pull Requests

Ensure the following before requesting review:
CI passes (test/typecheck/build/format) and the PR title follows Conventional Commits.

## Release Workflow

This repository now uses [changelogen](https://github.com/unjs/changelogen) to infer the next semantic version from Conventional Commits, update `CHANGELOG.md`, and create the release commit plus tag. The workflow is intentionally linear so that a single maintainer can ship safely end to end.

1. Ensure `main` is up to date and clean. Run `pnpm changelog --no-output` if you want to preview the generated notes without touching the tree.
2. Execute `pnpm release`. This script runs `pnpm test`, `pnpm build`, and `changelogen --release` in sequence. The command bumps the version in `package.json`, rewrites `CHANGELOG.md`, and creates a `chore(release): vX.Y.Z` commit alongside the annotated `vX.Y.Z` tag.
   - If you want to force the bump level (for example, keep using minor bumps during the 0.x phase), pass `--minor` / `--patch` / etc: `pnpm release -- --minor`.
3. Push the commit and tag together: `git push origin main --follow-tags`. If you need to stage multiple release commits, push in chronological order so tags stay in sync.
4. Tag pushes trigger `.github/workflows/publish.yml` automatically. The job runs on the `release` environment, installs dependencies, executes tests/type checks/build, publishes to npm via OIDC trusted publishing, and then calls `pnpm exec changelogen gh release vX.Y.Z --token $GITHUB_TOKEN` to sync the GitHub Release body with the freshly updated `CHANGELOG.md`.

If the publish workflow fails, fix the root cause and re-run the job from the GitHub Actions UI. Avoid creating a new tag unless you intend to cut a new release. If you must roll back, delete the tag locally and remotely, revert the release commit, and start over from step 1.
