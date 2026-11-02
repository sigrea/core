# Contributing to @sigrea/core

Thank you for contributing! This project uses a PR-based workflow with required CI checks.

## Requirements

Install [Vite+](https://viteplus.dev/guide/). Node.js and pnpm versions are pinned
in `.node-version` and `package.json`.

```sh
vp env install
vp install --frozen-lockfile
```

## Commands

- `vp check` — format, lint, and TypeScript checks
- `vp test run` — unit tests
- `vp test run --coverage` — coverage
- `vp pack` — ESM/CJS bundles and declarations
- `vp fmt` — format source files
- `vp run cicheck` — checks, tests, packaging, and smoke checks

The pre-commit hook fixes staged files and runs the test suite.

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
4. Tag pushes run `.github/workflows/publish.yml` in the `release` environment and publish to npm through OIDC.

If the publish workflow fails, fix the root cause and re-run the job from the GitHub Actions UI. Avoid creating a new tag unless you intend to cut a new release. If you must roll back, delete the tag locally and remotely, revert the release commit, and start over from step 1.
