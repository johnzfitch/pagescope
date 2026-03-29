#!/bin/bash
# Build PageScope extension

cd "$(dirname "$0")"

echo "Building PageScope extension..."

mkdir -p dist/

# Read version from manifest.json (try python3 first, then python, then pure shell fallback)
if command -v python3 >/dev/null 2>&1; then
  VERSION="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')"
elif command -v python >/dev/null 2>&1; then
  VERSION="$(python -c 'import json; print(json.load(open("manifest.json"))["version"])')"
else
  # Pure shell fallback: extract version using grep/sed
  VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' manifest.json | sed 's/.*"\([0-9.]*\)"/\1/')"
fi
OUT="dist/pagescope-v${VERSION}.xpi"

# Create XPI
zip -r -FS "${OUT}" \
    manifest.json \
    background.js \
    content.js \
    sidebar/ \
    popup/ \
    options/ \
    icons/ \
    --exclude '*.git*' \
    --exclude 'node_modules/*' \
    --exclude 'build.sh'

# Also write a stable filename for convenience.
cp -f "${OUT}" dist/pagescope.xpi

echo "Built: ${OUT} ($(du -h "${OUT}" | cut -f1))"
