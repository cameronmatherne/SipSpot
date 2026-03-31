#!/usr/bin/env bash
set -euo pipefail

# Fetches bars/restaurants within 25 miles of Lafayette, LA from OpenStreetMap (Overpass).
#
# Output:
# - data/raw/osm_lafayette_<YYYY-MM-DD>.json
#
# Usage:
#   ./scripts/lafayette/fetch_osm.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/data/raw"

mkdir -p "$OUT_DIR"

RADIUS_METERS="40234" # 25 miles
LAT="30.2241"
LON="-92.0198"

QUERY="$(cat <<'OVERPASS'
[out:json][timeout:180];
(
  node["amenity"~"^(bar|pub|restaurant|fast_food|biergarten|nightclub|cafe|ice_cream|food_court)$"](around:RADIUS,LAT,LON);
  way["amenity"~"^(bar|pub|restaurant|fast_food|biergarten|nightclub|cafe|ice_cream|food_court)$"](around:RADIUS,LAT,LON);
  relation["amenity"~"^(bar|pub|restaurant|fast_food|biergarten|nightclub|cafe|ice_cream|food_court)$"](around:RADIUS,LAT,LON);

  node["craft"~"^(brewery|distillery|winery)$"](around:RADIUS,LAT,LON);
  way["craft"~"^(brewery|distillery|winery)$"](around:RADIUS,LAT,LON);
  relation["craft"~"^(brewery|distillery|winery)$"](around:RADIUS,LAT,LON);
);
out center tags;
OVERPASS
)"

QUERY="${QUERY//RADIUS/$RADIUS_METERS}"
QUERY="${QUERY//LAT/$LAT}"
QUERY="${QUERY//LON/$LON}"

STAMP="${UTC_DATE:-$(date -u +%F)}"
OUT_FILE="$OUT_DIR/osm_lafayette_${STAMP}.json"

echo "Fetching Overpass data -> $OUT_FILE"

TMP_FILE="$(mktemp "${OUT_DIR}/.osm_lafayette_${STAMP}.XXXXXX.json")"

ENDPOINTS=(
  "https://overpass-api.de/api/interpreter"
  "https://gall.openstreetmap.de/api/interpreter"
  "https://overpass.kumi.systems/api/interpreter"
)

validate_json() {
  jq -e '.elements and (.elements|type=="array")' "$1" >/dev/null 2>&1
}

fetch_once() {
  local endpoint="$1"
  curl -sS -X POST \
    -H "Accept: application/json" \
    --data-urlencode "data=${QUERY}" \
    "$endpoint" \
    >"$TMP_FILE"
}

success="0"
for endpoint in "${ENDPOINTS[@]}"; do
  for attempt in 1 2 3; do
    echo "Overpass endpoint: $endpoint (attempt $attempt/3)"
    if fetch_once "$endpoint" && validate_json "$TMP_FILE"; then
      success="1"
      break 2
    fi

    # Some Overpass failures return HTML/XML with a 200 OK status.
    echo "Non-JSON response; backing off..."
    sleep "$((attempt * 2))"
  done
done

if [[ "$success" != "1" ]]; then
  echo "Failed to fetch valid JSON from Overpass endpoints." >&2
  echo "First 15 lines of last response:" >&2
  head -n 15 "$TMP_FILE" >&2 || true
  rm -f "$TMP_FILE"
  exit 1
fi

mv "$TMP_FILE" "$OUT_FILE"
echo "Wrote $(wc -c <"$OUT_FILE" | tr -d ' ') bytes"
