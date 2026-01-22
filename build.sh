#!/bin/bash
# Build PageScope extension

cd "$(dirname "$0")"

echo "Building PageScope extension..."

# Clean old build
rm -rf dist/
mkdir -p dist/

# Create XPI
zip -r -FS dist/pagescope.xpi \
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

echo "✓ Built: dist/pagescope.xpi ($(du -h dist/pagescope.xpi | cut -f1))"
