#!/usr/bin/env bash
set -euo pipefail

# Generates a list of all bars/restaurants within 25 miles of Lafayette, LA.
#
# Outputs:
# - data/raw/osm_lafayette_<YYYY-MM-DD>.json
# - data/generated/spots_lafayette_<YYYY-MM-DD>.json
#
# Usage:
#   ./scripts/lafayette/generate_spots.sh
#   UTC_DATE=2026-03-16 ./scripts/lafayette/generate_spots.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

STAMP="${UTC_DATE:-$(date -u +%F)}"
RAW_FILE="$ROOT_DIR/data/raw/osm_lafayette_${STAMP}.json"
OUT_FILE="$ROOT_DIR/data/generated/spots_lafayette_${STAMP}.json"

"$ROOT_DIR/scripts/lafayette/fetch_osm.sh"

node "$ROOT_DIR/scripts/lafayette/osm_to_spots.mjs" "$RAW_FILE" "$OUT_FILE"

echo "Done: $OUT_FILE"
