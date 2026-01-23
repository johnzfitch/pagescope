# PageScope Testing Guide

## Testing Infrastructure Installed 

Firefox extension E2E testing using Marionette protocol (native Firefox automation, no Selenium/geckodriver needed).

## Quick Test Run

### Option 1: Automated Quick Test (Recommended)

```bash
# Single command - launches Firefox and shows test commands
./test/quick-test.sh
```

This will:
1. Build the extension
2. Launch Firefox with Marionette
3. Display test commands you can run in another terminal

### Option 2: Manual Launch

```bash
# Terminal 1: Launch Firefox with PageScope
test/scripts/launch.sh .

# Terminal 2: Run basic tests
node test/scripts/interact.mjs navigate "https://example.com"
node test/scripts/interact.mjs title
node test/scripts/interact.mjs screenshot test/example.png
```

### Verify All v0.0.6 Fixes

```bash
# While Firefox is running (from quick-test.sh):
# Terminal 2:
./test/verify-fixes.sh
```

This script verifies:
- Duplicate injection guard
- Ping handler
- Extension UUID retrieval
- Sidebar loads correctly
- Empty state visible
- Browser storage access
- Screenshot capture

## MVP Verification Commands

All fixes from v0.0.6 can be verified:

### 1. No Duplicate Injection
```bash
node test/scripts/interact.mjs exec "window.__pageScopeInitialized"
# Should be true (once), not undefined or duplicated
```

### 2. Ping Handler
```bash
node test/scripts/interact.mjs exec "
  browser.runtime.sendMessage({ action: 'ping' })
    .then(r => r?.status)
"
# Should return "ready"
```

### 3. No Layout Thrashing (Batched getBoundingClientRect)
```bash
# Enable Performance API
node test/scripts/interact.mjs exec "performance.mark('start')"
node test/scripts/interact.mjs click "#highlight-all"
node test/scripts/interact.mjs exec "
  performance.mark('end');
  performance.measure('highlight', 'start', 'end').duration
"
# Should be <100ms even with many elements
```

### 4. Shadow DOM Text Extraction
```bash
# Test on page with shadow DOM (like AI Studio)
# Text blocks should be found inside shadow roots
```

### 5. Code Block Deduplication
```bash
# Navigate to page with nested sections/articles
# Export JSON and verify no duplicate code blocks
```

## Full Documentation

See `test/README.md` for:
- Complete command reference
- Test scenarios
- Integration with CI/CD
- Troubleshooting guide

## Extension-Specific Tests

```bash
# Get extension UUID
UUID=$(node test/scripts/test-extension.mjs uuid)

# Open sidebar
node test/scripts/interact.mjs navigate "moz-extension://$UUID/sidebar/sidebar.html"

# Test Load button
node test/scripts/interact.mjs click "#refresh"

# Check browser storage
node test/scripts/test-extension.mjs storage

# Execute in background context
node test/scripts/test-extension.mjs bg "browser.storage.local.get()"
```

## Architecture

```
PageScope Extension (v0.0.6)
  ↓
Firefox (Marionette enabled)
  ↓
Marionette Protocol (TCP port 2828)
  ↓
Test Scripts (ESM, zero dependencies)
  ├── marionette.mjs (protocol client)
  ├── interact.mjs (CLI commands)
  └── test-extension.mjs (extension utils)
```

## Benefits

- Zero dependencies (native Node.js net module)
- Direct Firefox protocol access
- Extension background script execution
- Browser storage access
- Screenshot capture
- Unsigned extension loading
- Headless mode support
