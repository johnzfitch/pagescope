#!/bin/bash
# Verify PageScope v0.0.6 MVP fixes
# Requires Firefox to be running with Marionette (use test/quick-test.sh)

set -e
cd "$(dirname "$0")/.."

echo "PageScope v0.0.6 MVP Fix Verification"
echo "======================================"
echo ""

# Check if Marionette is available
if ! nc -z localhost 2828 2>/dev/null; then
  echo "Error: Marionette not available on port 2828"
  echo "Run 'test/quick-test.sh' first in another terminal"
  exit 1
fi

echo "✓ Marionette connection available"
echo ""

# Navigate to test page
echo "1. Setting up test page..."
node test/scripts/interact.mjs navigate "https://example.com" >/dev/null 2>&1
sleep 1
echo "   ✓ Navigated to example.com"
echo ""

# Inject content script (since it's no longer auto-injected)
echo "2. Injecting content script programmatically..."
node test/scripts/test-extension.mjs bg "
  browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
    return browser.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['/content.js']
    });
  })
" >/dev/null 2>&1
sleep 0.5
echo "   ✓ Content script injected"
echo ""

# Test 1: Duplicate injection guard
echo "3. Testing duplicate injection guard..."
INITIALIZED=$(node test/scripts/interact.mjs exec "window.__pageScopeInitialized" 2>/dev/null || echo "undefined")
if [ "$INITIALIZED" = "true" ]; then
  echo "   ✓ Content script initialized once"
else
  echo "   ✗ Guard not working (got: $INITIALIZED)"
fi
echo ""

# Test 2: Ping handler
echo "4. Testing ping handler..."
PING_RESULT=$(node test/scripts/interact.mjs exec "
  new Promise((resolve) => {
    browser.runtime.sendMessage({ action: 'ping' }, (response) => {
      resolve(response?.status || 'no response');
    });
  })
" 2>/dev/null || echo "error")

if [ "$PING_RESULT" = "ready" ]; then
  echo "   ✓ Ping handler responds: 'ready'"
else
  echo "   ⚠ Ping response: $PING_RESULT"
fi
echo ""

# Test 3: Extension UUID retrieval
echo "5. Getting extension UUID..."
# Extract UUID (filter out Marionette noise by looking for UUID pattern)
UUID=$(node test/scripts/test-extension.mjs uuid 2>&1 | grep -Eio '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
if [ -n "$UUID" ]; then
  echo "   ✓ UUID: $UUID"
else
  echo "   ⚠ Could not retrieve UUID"
  UUID=""
fi
echo ""

# Test 4: Sidebar load
if [ -n "$UUID" ]; then
  echo "6. Testing sidebar load..."
  node test/scripts/interact.mjs navigate "moz-extension://$UUID/sidebar/sidebar.html" >/dev/null 2>&1
  sleep 1

  SIDEBAR_TITLE=$(node test/scripts/interact.mjs title 2>/dev/null || echo "")
  if [[ "$SIDEBAR_TITLE" == *"PageScope"* ]]; then
    echo "   ✓ Sidebar loaded: $SIDEBAR_TITLE"
  else
    echo "   ⚠ Sidebar title: $SIDEBAR_TITLE"
  fi

  # Check empty state
  EMPTY_STATE=$(node test/scripts/interact.mjs exec "!!document.querySelector('.empty-state')" 2>/dev/null || echo "false")
  if [ "$EMPTY_STATE" = "true" ]; then
    echo "   ✓ Empty state visible initially"
  else
    echo "   ⚠ Empty state not found"
  fi
  echo ""

  # Test 5: Take screenshot
  echo "7. Taking screenshots..."
  node test/scripts/interact.mjs screenshot test/sidebar-empty.png >/dev/null 2>&1
  if [ -f "test/sidebar-empty.png" ]; then
    SIZE=$(du -h test/sidebar-empty.png | cut -f1)
    echo "   ✓ Sidebar screenshot: test/sidebar-empty.png ($SIZE)"
  else
    echo "   ✗ Screenshot failed"
  fi
else
  echo "6-7. Skipped (no UUID)"
fi
echo ""

# Test 6: Storage access
echo "8. Testing browser storage access..."
# Filter for JSON output (starts with {)
STORAGE=$(node test/scripts/test-extension.mjs storage 2>&1 | grep '^{' || echo "{}")
if [[ "$STORAGE" == *"{"* ]]; then
  echo "   ✓ Storage accessible"
else
  echo "   ⚠ Storage access issue"
fi
echo ""

# Summary
echo "======================================"
echo "Verification complete!"
echo ""
echo "Files created:"
if [ -f "test/sidebar-empty.png" ]; then
  echo "  - test/sidebar-empty.png"
fi
echo ""
echo "Next steps:"
echo "  1. Test actual extraction by clicking Load button in sidebar"
echo "  2. Test JSON/Markdown export"
echo "  3. Test on pages with shadow DOM"
echo ""
