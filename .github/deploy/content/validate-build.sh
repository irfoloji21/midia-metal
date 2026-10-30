#!/usr/bin/env bash
set -euo pipefail
DIST_DIR="${DIST_DIR:-dist}"

# Astro can put the admin stylesheet in the server bundle; it must also be public.
shopt -s nullglob
server_css=("$DIST_DIR"/server/_astro/*.css)
if (( ${#server_css[@]} )); then
  cp "${server_css[@]}" "$DIST_DIR/client/_astro/"
fi
admin_css=("$DIST_DIR"/client/_astro/_path_*.css)
if (( ${#admin_css[@]} == 0 )); then
  echo '::error::Admin CSS bundle is missing.'
  exit 1
fi
for file in "${admin_css[@]}"; do
  if (( $(wc -c < "$file") < 100000 )); then
    echo '::error::Admin CSS bundle is incomplete.'
    exit 1
  fi
  for class in text-muted-foreground bg-sidebar rounded-md border-border; do
    grep -q "$class" "$file" || { echo "::error::Admin CSS missing $class"; exit 1; }
  done
done

test -f "$DIST_DIR/server/entry.mjs"
# These content pages now use SSR; older builds may still prerender them.
for page in services blog portfolio; do
  if [[ ! -f "$DIST_DIR/server/pages/$page.astro.mjs" && ! -f "$DIST_DIR/client/$page/index.html" ]]; then
    echo "::error::Missing content route: $page"
    exit 1
  fi
done
echo 'Content build and admin CSS validation passed.'
