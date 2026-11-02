# Contributing to @sigrea/core

## Development

Install [Vite+](https://viteplus.dev/guide/). Node.js and pnpm versions are pinned
in `.node-version` and `package.json`.

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

The pre-commit hook fixes staged files. Run `vp run cicheck` before requesting review.
Use Conventional Commits for PR titles; squash merges use the title as the commit
message, and changelogen reads it for release notes.

Describe the problem and resulting behavior in the PR. Include manual verification
or remaining gaps when relevant; routine CI results do not need repeating.

## Releases

Releases publish stable `x.y.z` versions through GitHub Actions using npm OIDC.

1. Start on a clean `main` matching `origin/main`. Preview notes with `vp run notes`.
2. Run `SIGREA_RELEASE_VERSION=x.y.z vp run release_version`. It checks the version
   and tags, runs `cicheck`, updates the version and CHANGELOG, formats the package,
   and creates one commit and an annotated tag. It does not publish a GitHub Release.
3. Run `vp run push_release`. It verifies the tag and remote main, then asks before
   pushing main and that tag atomically. Other local tags are not pushed.
4. The tag workflow checks the version and main ancestry, tests the package, packs
   it once, and smoke-tests the extracted tarball before publishing it to npm.
   It then creates or updates the GitHub Release from CHANGELOG using `gh`.

The target version must be newer than the current package version and its tag must
not exist. If preparation fails after editing files, inspect those changes before
retrying; the script does not discard changes or rewrite commits and tags.

## Recovering a release

- If the publish workflow fails before npm publication, fix the cause and rerun the
  failed job on the same tag. If the tagged source needs changing, cut a new version.
- If npm publication succeeds but the GitHub Release step fails, rerun the job.
  It skips the published npm version and finishes the GitHub Release.
- If a published package is faulty, publish a corrected version. Deleting a Git tag
  or unpublishing npm does not make that version reusable. Never move a pushed tag.
