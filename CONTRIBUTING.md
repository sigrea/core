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

## Changesets

Add a changeset for any user-facing change:
features, bug fixes that affect consumers, deprecations, or breaking changes.
Run `pnpm changeset` locally and commit the generated file.

No changeset is required for docs, chore, refactor-only, or test-only changes.

## Pull Requests

Ensure the following before requesting review:
CI passes (typecheck/format/test-build) and the PR title follows Conventional Commits.
Add a changeset if the change is user-facing; otherwise mention N/A in the PR template.

On pull requests, compressed size checks (gzip/brotli) run against built artifacts.
If a significant size increase is reported, please consider API surface, tree-shaking, and dependency choices.

## Labels

Repository labels are synchronized automatically from `.github/labels.yml`.
You do not need to create labels manually.

## Release Workflow

This repository uses Changesets for versioning and GitHub Actions for publishing.

Current setup (manual publish):

1. On every change merged to `main`, a Changesets action opens or updates a "Version Packages" PR.
   The version bump and changelog are maintained in that PR.
2. When maintainers decide to release, they merge the version PR, then run the `publish` workflow manually (workflow dispatch) in the `release` environment.
3. The `publish` workflow builds, runs tests, publishes to npm with provenance (`--provenance`), tags the commit as `vX.Y.Z`, and creates a GitHub Release with auto-generated notes.

Optional alternative (automatic publish):

It is possible to automate publishing on merge to `main` by granting the release workflow `id-token: write` and configuring Changesets action to run `pnpm changeset publish` automatically. This removes the manual `workflow_dispatch` step and publishes as soon as the version PR is merged. Pros: faster releases; Cons: less human gating for last checks and environment coordination.

Operational policy:

We keep manual publish by default to allow final verification and coordinated release notes. When switching to auto-publish, announce the policy in this document and ensure tokens/permissions are properly configured.
