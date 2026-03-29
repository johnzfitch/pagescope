#!/bin/bash
# Quick manual test for PageScope
# Usage: ./test/quick-test.sh

set -e
cd "$(dirname "$0")/.."

echo "PageScope Quick Test"
echo "==================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v firefox >/dev/null 2>&1 || { echo "  ✗ firefox not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "  ✗ node not found"; exit 1; }
command -v nc >/dev/null 2>&1 || { echo "  ✗ nc (netcat) not found"; exit 1; }
echo "  ✓ All prerequisites met"
echo ""

# Build extension
echo "Building extension..."
if bash build.sh >/dev/null 2>&1; then
  # Find the built XPI (versioned filename)
  XPI=$(ls -t dist/pagescope-v*.xpi 2>/dev/null | head -1)
  if [ -n "$XPI" ]; then
    echo "  ✓ Built: $XPI"
  else
    echo "  ✓ Built: dist/pagescope.xpi"
  fi
else
  echo "  ✗ Build failed"
  exit 1
fi
echo ""

# Launch Firefox
echo "Launching Firefox with PageScope..."
echo "  (Firefox will open in a new window)"
echo ""

test/scripts/launch.sh . &
LAUNCH_PID=$!

echo "  Background PID: $LAUNCH_PID"
echo ""

# Wait for ready
echo "Waiting for Marionette to be ready..."
READY=false
for i in {1..30}; do
  if nc -z localhost 2828 2>/dev/null; then
    READY=true
    echo "  ✓ Marionette ready on port 2828"
    break
  fi
  sleep 0.5
done

if [ "$READY" = false ]; then
  echo "  ✗ Timeout waiting for Marionette"
  kill $LAUNCH_PID 2>/dev/null || true
  exit 1
fi

echo ""
echo "========================================="
echo "Firefox is ready for testing!"
echo "========================================="
echo ""
echo "Try these commands in another terminal:"
echo ""
echo "  cd $(pwd)"
echo ""
echo "  # Basic navigation"
echo "  node test/scripts/interact.mjs navigate \"https://example.com\""
echo "  node test/scripts/interact.mjs title"
echo ""
echo "  # Take screenshot"
echo "  node test/scripts/interact.mjs screenshot test/page.png"
echo ""
echo "  # Get extension UUID"
echo "  UUID=\$(node test/scripts/test-extension.mjs uuid)"
echo "  echo \$UUID"
echo ""
echo "  # Open sidebar"
echo "  node test/scripts/interact.mjs navigate \"moz-extension://\$UUID/sidebar/sidebar.html\""
echo ""
echo "  # Check storage"
echo "  node test/scripts/test-extension.mjs storage"
echo ""
echo "========================================="
echo ""
echo "Press Ctrl+C to stop Firefox and exit"
echo ""

# Wait for user to kill
trap "kill $LAUNCH_PID 2>/dev/null || true; echo ''; echo 'Firefox stopped.'; exit 0" INT TERM

wait $LAUNCH_PID 2>/dev/null || true
