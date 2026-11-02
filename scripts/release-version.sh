#!/bin/sh
set -eu
test "$(git rev-parse --abbrev-ref HEAD)" = "main"
test -n "${SIGREA_RELEASE_VERSION:-}" || { echo "SIGREA_RELEASE_VERSION is required, for example SIGREA_RELEASE_VERSION=0.7.1 vp run release_version." >&2; exit 1; }
test -z "$(git status --porcelain)" || { echo "Git status must be clean before release." >&2; git status --short; exit 1; }
vp run cicheck
test -z "$(git status --porcelain)" || { echo "cicheck changed files." >&2; git status --short; exit 1; }
vp exec changelogen --clean --release -r "$SIGREA_RELEASE_VERSION"
vp fmt
if ! git diff --quiet; then
  git add -A
  git commit --amend --no-edit
  git tag -fa "v$SIGREA_RELEASE_VERSION" -m "v$SIGREA_RELEASE_VERSION"
fi
test "$(git cat-file -t "v$SIGREA_RELEASE_VERSION")" = "tag"
test -z "$(git status --porcelain)" || { echo "Release changed files unexpectedly." >&2; git status --short; exit 1; }
