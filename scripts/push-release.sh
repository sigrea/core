#!/bin/sh
set -eu
test "$(git rev-parse --abbrev-ref HEAD)" = "main"
printf 'Push main and tags to origin? [y/N] '
read -r answer
case "$answer" in
  y|Y|yes|YES) git push origin main --follow-tags ;;
  *) echo 'Cancelled.'; exit 1 ;;
esac
