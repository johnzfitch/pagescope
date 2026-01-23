# PageScope Testing Infrastructure

## Status

Testing infrastructure installed and ready
Scripts validated and working
Firefox detected: Mozilla Firefox 146.0

## Files Installed

```
test/
├── scripts/
│   ├── launch.sh              # Launch Firefox with extension
│   ├── marionette.mjs         # Low-level Marionette protocol client
│   ├── interact.mjs           # CLI automation tool
│   ├── test-extension.mjs     # Extension-specific utilities
│   └── install-addon.mjs      # Extension installer
├── test-pagescope.mjs         # Full E2E test suite
└── README.md                  # This file
```

## Quick Start

### 1. Launch Firefox with PageScope

```bash
# Terminal 1: Launch Firefox (headless or GUI)
cd /home/zack/dev/pagescope-extension
test/scripts/launch.sh .

# Or headless:
HEADLESS=1 test/scripts/launch.sh .
```

### 2. Run Tests (from another terminal)

```bash
# Terminal 2: Run automation commands
cd /home/zack/dev/pagescope-extension

# Basic navigation
node test/scripts/interact.mjs navigate "https://example.com"
node test/scripts/interact.mjs title
node test/scripts/interact.mjs screenshot test/page.png

# Get extension UUID
node test/scripts/test-extension.mjs uuid

# Open sidebar (replace UUID)
node test/scripts/interact.mjs navigate "moz-extension://<UUID>/sidebar/sidebar.html"

# Execute in page context
node test/scripts/interact.mjs exec "document.title"

# Execute in extension background
node test/scripts/test-extension.mjs bg "browser.storage.local.get()"
```

## Available Commands

### interact.mjs

- `navigate <url>` - Load URL
- `title` - Get page title
- `screenshot <file.png>` - Capture screenshot (add `--full` for full page)
- `click <selector>` - Click element by CSS selector
- `type <selector> <text>` - Type into element
- `text <selector>` - Get element text
- `exec <js>` - Run JavaScript in page context
- `exec-chrome <js>` - Run JavaScript in chrome context
- `wait <ms>` - Sleep
- `back` / `forward` / `refresh` - Navigation

### test-extension.mjs

- `uuid` - Get extension UUID
- `popup [page]` - Open extension page
- `storage` - Get browser.storage.local contents
- `bg <script>` - Execute script in background context

## Testing Scenarios

### Scenario 1: Test Sidebar Load

```bash
# 1. Launch Firefox
test/scripts/launch.sh .

# 2. Get UUID (in another terminal)
UUID=$(node test/scripts/test-extension.mjs uuid)

# 3. Open sidebar
node test/scripts/interact.mjs navigate "moz-extension://$UUID/sidebar/sidebar.html"

# 4. Check initial state
node test/scripts/interact.mjs exec "!!document.querySelector('.empty-state')"

# 5. Screenshot
node test/scripts/interact.mjs screenshot test/sidebar-empty.png
```

### Scenario 2: Test Page Extraction

```bash
# 1. Navigate to test page
node test/scripts/interact.mjs navigate "https://example.com"

# 2. Open sidebar
UUID=$(node test/scripts/test-extension.mjs uuid)
node test/scripts/interact.mjs navigate "moz-extension://$UUID/sidebar/sidebar.html"

# 3. Click Load button
node test/scripts/interact.mjs click "#refresh"

# 4. Wait for extraction
node test/scripts/interact.mjs wait 2000

# 5. Check if data loaded
node test/scripts/interact.mjs exec "document.querySelectorAll('#structure-tab .item').length"

# 6. Screenshot result
node test/scripts/interact.mjs screenshot test/sidebar-loaded.png
```

### Scenario 3: Test Content Script Ping

```bash
# 1. Navigate to page
node test/scripts/interact.mjs navigate "https://example.com"

# 2. Test ping (should return "ready")
node test/scripts/interact.mjs exec "
  new Promise((resolve) => {
    browser.runtime.sendMessage({ action: 'ping' }, (response) => {
      resolve(response?.status);
    });
  })
"
```

### Scenario 4: Test Export

```bash
# 1. After extracting data (see Scenario 2)
# 2. Switch to structure tab
node test/scripts/interact.mjs click '[data-tab="structure"]'

# 3. Click export JSON
node test/scripts/interact.mjs exec "document.querySelector('#export-json').click()"
```

## Verification Tests

Run these to verify the MVP fixes:

### Fix 1: No Duplicate Injection

```bash
# Should only see one instance
node test/scripts/interact.mjs exec "window.__pageScopeInitialized"
# Expected: true (only once, not multiple times)
```

### Fix 2: Ping Handler Works

```bash
node test/scripts/interact.mjs exec "
  browser.runtime.sendMessage({ action: 'ping' })
    .then(r => r.status)
"
# Expected: "ready"
```

### Fix 3: No Layout Thrashing

```bash
# Enable performance monitoring before clicking highlight
node test/scripts/interact.mjs exec "performance.mark('start')"
node test/scripts/interact.mjs click "#highlight-all"
node test/scripts/interact.mjs exec "performance.mark('end'); performance.measure('highlight', 'start', 'end').duration"
# Expected: <100ms for typical page
```

### Fix 4: Shadow DOM Traversal

```bash
# Navigate to page with shadow DOM
node test/scripts/interact.mjs navigate "https://aistudio.google.com"
# Wait, then extract
UUID=$(node test/scripts/test-extension.mjs uuid)
node test/scripts/interact.mjs navigate "moz-extension://$UUID/sidebar/sidebar.html"
node test/scripts/interact.mjs click "#refresh"
# Check text blocks found
node test/scripts/interact.mjs exec "document.querySelectorAll('.item').length > 0"
```

## Notes

- Firefox must be running with Marionette (launched by `launch.sh`)
- Default Marionette port: `localhost:2828`
- Extensions are loaded unsigned via `--load-temp-addon`
- Profile is ephemeral by default
- Screenshots saved to `test/` directory

## Troubleshooting

**Port already in use:**
```bash
# Kill existing Firefox instances
pkill -f "firefox.*marionette"
```

**Extension not loading:**
```bash
# Verify manifest.json exists
test -f manifest.json && echo "OK" || echo "Missing manifest"
```

**Scripts not working:**
```bash
# Verify Node.js supports ESM
node --version  # Should be v14+
```

## Architecture

```
launch.sh
  ↓
Firefox (Marionette enabled, port 2828)
  ↓
Extension loaded unsigned
  ↓
interact.mjs / test-extension.mjs
  ↓
Marionette Protocol (TCP socket)
  ↓
WebDriver commands
```

## Integration with CI/CD

```yaml
# .github/workflows/test.yml
- name: Install Firefox
  run: apt-get install -y firefox

- name: Run E2E Tests
  run: |
    HEADLESS=1 test/scripts/launch.sh . &
    sleep 5
    node test/test-pagescope.mjs
```
