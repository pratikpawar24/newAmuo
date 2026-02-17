#!/usr/bin/env bash
# ============================================
# AUMO v2 — Download OSM Data Script
# Downloads OpenStreetMap data for the target city
# Used by the AI service graph builder
# ============================================

set -euo pipefail

echo "🗺️  AUMO v2 — OSM Data Downloader"
echo "===================================="

# Configuration
CITY="${1:-mumbai}"
DATA_DIR="${2:-./ai-service/data}"
OVERPASS_URL="https://overpass-api.de/api/interpreter"

echo "📍 City: $CITY"
echo "📂 Output: $DATA_DIR"
echo ""

mkdir -p "$DATA_DIR"

# ── Define bounding boxes for supported cities ──
case "$CITY" in
  mumbai)
    BBOX="18.89,72.77,19.27,72.98"
    ;;
  delhi)
    BBOX="28.40,76.84,28.88,77.35"
    ;;
  bangalore|bengaluru)
    BBOX="12.85,77.46,13.09,77.76"
    ;;
  chennai)
    BBOX="12.90,80.15,13.20,80.32"
    ;;
  pune)
    BBOX="18.43,73.75,18.63,73.96"
    ;;
  *)
    echo "⚠️  Unknown city: $CITY"
    echo "   Supported: mumbai, delhi, bangalore, chennai, pune"
    echo "   Usage: $0 <city> [output_dir]"
    echo ""
    echo "   You can also pass a custom bounding box:"
    echo "   BBOX=\"lat_min,lon_min,lat_max,lon_max\" $0 custom"
    if [ -z "${BBOX:-}" ]; then
      exit 1
    fi
    ;;
esac

echo "📐 Bounding box: $BBOX"

# ── Download road network via Overpass API ──
OUTPUT_FILE="$DATA_DIR/${CITY}_roads.json"

echo "⏳ Downloading road network from Overpass API..."

QUERY="[out:json][timeout:120];
(
  way[\"highway\"~\"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$\"](${BBOX});
);
out body;
>;
out skel qt;"

HTTP_CODE=$(curl -s -o "$OUTPUT_FILE" -w "%{http_code}" \
  --data-urlencode "data=$QUERY" \
  "$OVERPASS_URL" \
  --max-time 180 \
  2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  ELEMENTS=$(python3 -c "import json; d=json.load(open('$OUTPUT_FILE')); print(len(d.get('elements',[])))" 2>/dev/null || echo "?")
  echo "✅ Downloaded: $OUTPUT_FILE ($FILE_SIZE, $ELEMENTS elements)"
else
  echo "❌ Download failed (HTTP $HTTP_CODE)"
  echo "   The Overpass API may be overloaded. Try again later."
  echo "   Alternatively, download from: https://download.geofabrik.de/"
  rm -f "$OUTPUT_FILE"
  exit 1
fi

# ── Download POI data (optional) ──
POI_FILE="$DATA_DIR/${CITY}_pois.json"

echo ""
echo "⏳ Downloading points of interest..."

POI_QUERY="[out:json][timeout:60];
(
  node[\"amenity\"~\"^(fuel|parking|bus_station|train_station|taxi)$\"](${BBOX});
  node[\"public_transport\"](${BBOX});
);
out body;"

POI_CODE=$(curl -s -o "$POI_FILE" -w "%{http_code}" \
  --data-urlencode "data=$POI_QUERY" \
  "$OVERPASS_URL" \
  --max-time 120 \
  2>/dev/null || echo "000")

if [ "$POI_CODE" = "200" ]; then
  POI_SIZE=$(du -h "$POI_FILE" | cut -f1)
  echo "✅ Downloaded: $POI_FILE ($POI_SIZE)"
else
  echo "⚠️  POI download failed (non-critical). Continuing..."
  rm -f "$POI_FILE"
fi

# ── Summary ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Download Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   City:       $CITY"
echo "   Road data:  $OUTPUT_FILE"
[ -f "$POI_FILE" ] && echo "   POI data:   $POI_FILE"
echo ""
echo "🔧 To use with AUMO AI service:"
echo "   Set OSM_DATA_PATH=$OUTPUT_FILE in your .env"
echo ""
echo "🎉 Done!"
