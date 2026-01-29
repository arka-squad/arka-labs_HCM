#!/usr/bin/env sh
set -e

: "${HCM_ROOT:=/hcm}"

mkdir -p "$HCM_ROOT"

SEED_DIR="/seed/hcm"

seed_missing_files() {
  if [ ! -d "$SEED_DIR" ]; then
    return
  fi

  (cd "$SEED_DIR" && find . -type f) | while read -r rel; do
    rel="${rel#./}"
    src="$SEED_DIR/$rel"
    dst="$HCM_ROOT/$rel"
    dst_dir="$(dirname "$dst")"
    mkdir -p "$dst_dir"
    if [ ! -f "$dst" ]; then
      cp "$src" "$dst"
    fi
  done
}

if [ ! -f "$HCM_ROOT/meta.json" ]; then
  if [ -d "$SEED_DIR" ]; then
    echo "[hcm] Seeding HCM root in $HCM_ROOT"
    cp -R "$SEED_DIR"/. "$HCM_ROOT"
  else
    echo "[hcm] No seed found; initializing minimal HCM in $HCM_ROOT"
    node /app/apps/api/dist/cli/index.js init
  fi
fi

# If HCM was created by init() or partially provisioned, backfill missing seed files (no overwrite).
seed_missing_files

exec "$@"
