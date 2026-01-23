# PageScope Extension - Debug Handoff Document

## Project Status: v0.0.6 (MVP Ready for Testing)

**Last Updated:** 2026-01-23
**Current State:** All fixes implemented, testing infrastructure installed, ready for validation

---

## Quick Context

**What is PageScope?**
Firefox extension that extracts semantic page structure, accessibility information, and interactive elements from web pages. Exports to JSON/Markdown/Text.

**What was just done?**
- Fixed 9 critical browser performance and security issues
- Removed 11KB dead code (unused shadow-dom-selector library)
- Optimized DOM traversal (O(n) single-pass vs O(n×m) multi-pass)
- Added E2E testing infrastructure (Marionette protocol)
- Reduced permissions and switched to programmatic content script injection

**Current Goal:**
Debug and validate v0.0.6 fixes work correctly across different websites and scenarios.

---

## Critical Files

### Core Extension Files
```
/home/zack/dev/pagescope-extension/
├── manifest.json           # MV3 manifest, permissions, scripts
├── background.js           # Toolbar button handler, sidebar toggle
├── content.js             # Main extraction logic (2132 lines)
├── sidebar/
│   ├── sidebar.html       # Extension sidebar UI
│   ├── sidebar.js         # UI logic, export functions (1100 lines)
│   └── sidebar.css        # Styling
├── options/
│   └── options.js         # Settings (braille resolution, etc.)
└── dist/
    ├── pagescope-v0.0.6.xpi  # Built extension (42KB)
    └── pagescope.xpi         # Same file, stable filename
```

### Testing Infrastructure
```
test/
├── scripts/
│   ├── marionette.mjs         # Marionette protocol client (217 lines)
│   ├── interact.mjs           # CLI automation tool
│   ├── test-extension.mjs     # Extension utilities (UUID, storage)
│   ├── launch.sh              # Firefox launcher with Marionette
│   └── install-addon.mjs      # Extension installer
├── quick-test.sh              # One-command test launcher
├── verify-fixes.sh            # MVP fix verification script
└── test-pagescope.mjs         # Full E2E test suite
```

### Documentation
```
├── TESTING.md             # Quick test guide
├── CHANGELOG.md           # v0.0.6 changes
├── test/README.md         # Complete testing docs
└── HANDOFF.md            # This file
```

---

## Recent Changes (v0.0.6)

### What Was Fixed

| Issue | Location | Fix |
|-------|----------|-----|
| **1. Shadow DOM text blocks regression** | `content.js:377-405` | Queue-based traversal replacing library fallback |
| **2. Duplicate code blocks** | `content.js:936-963` | Skip nested sections/articles with `closest()` check |
| **3. Text blocks export suppressed** | `sidebar.js:972-1009` | Hash-based dedup, emit "Additional Text Blocks" |
| **4. Manifest version** | `manifest.json:4` | Bumped to 0.0.6 |
| **5. Build script Python dependency** | `build.sh:10-18` | python3 → python → pure shell fallback |
| **6. Duplicate content script injection** | `content.js:31-34`, `sidebar.js:116-131` | Guard + ping check |
| **7. Unused shadow-dom-selector.js** | Removed `vendor/` | -11KB dead code |
| **8. Unused tabs permission** | `manifest.json` | Removed |
| **9. Layout thrashing in highlights** | `content.js:2099-2131` | Batched reads → DocumentFragment writes |

### Performance Optimizations

| Function | Before | After |
|----------|--------|-------|
| `getDirectText()` | Clone + 4× querySelectorAll | TreeWalker single-pass |
| `extractCodeBlocks()` | Clone + remove nested | Direct scan with closest() |
| `renderFencedCodeBlock()` | Regex matchAll max run | Simple includes('```') |
| `highlightElements()` | Read-write-read loop | Batched reads → fragment write |
| Text dedup | Full text in Set | First 200 chars hash |

---

## Known Issues & Gotchas

### 1. Headless Mode Incompatibility
**Symptom:** "Exiting due to channel error" in headless Firefox
**Cause:** Firefox headless + MV3 extensions + Marionette = IPC channel issues
**Solution:** Use GUI mode for testing (don't set `HEADLESS=1`)

### 2. Content Script Injection Timing
**Architecture Change:** Content script is NO LONGER auto-injected via `content_scripts` in manifest
**New Model:**
```
User clicks toolbar → background.js toggles sidebar
                   → sidebar.js pings content script
                   → if no response, injects content.js
                   → content script initializes once (guard)
```

**Debug Command:**
```javascript
// Check if content script loaded
browser.tabs.sendMessage(tabId, { action: 'ping' })
  .then(r => console.log('Content script status:', r.status))
  .catch(e => console.log('Not loaded'));
```

### 3. Extension UUID Changes
**Issue:** Extension UUID changes each Firefox session (temporary install)
**Impact:** `moz-extension://` URLs are ephemeral
**Solution:** Use `test-extension.mjs uuid` to get current UUID

### 4. Sidebar Context in Firefox
**Issue:** Sidebar runs in different context than popup
**Impact:** May need to re-inject content script when sidebar opens
**Current Solution:** Sidebar checks via ping, injects if needed

### 5. TreeWalker Filter Closure
**Location:** `content.js:905-917`
**Gotcha:** Filter references `excludeSelector` from outer scope - ensure it's defined before TreeWalker creation

---

## Testing the Extension

### Quick Start (GUI Mode)

```bash
cd /home/zack/dev/pagescope-extension

# Terminal 1: Launch Firefox with extension
./test/quick-test.sh

# Terminal 2: Run verification tests
./test/verify-fixes.sh
```

### Manual Testing Scenarios

#### Scenario 1: Basic Extraction
```bash
# Navigate to test page
node test/scripts/interact.mjs navigate "https://example.com"

# Get extension UUID
UUID=$(node test/scripts/test-extension.mjs uuid)

# Open sidebar
node test/scripts/interact.mjs navigate "moz-extension://$UUID/sidebar/sidebar.html"

# Check empty state
node test/scripts/interact.mjs exec "!!document.querySelector('.empty-state')"

# Click Load button
node test/scripts/interact.mjs click "#refresh"
node test/scripts/interact.mjs wait 2000

# Verify data extracted
node test/scripts/interact.mjs exec "document.querySelectorAll('.item').length"
```

#### Scenario 2: Shadow DOM Sites
Test sites with shadow DOM:
- https://aistudio.google.com (closed shadow roots)
- https://lit.dev (open shadow roots)
- Any site using Web Components

**Expected:** Text blocks should be extracted from shadow DOM content

**Verify:**
```bash
# After extraction
node test/scripts/interact.mjs exec "
  document.querySelectorAll('.item').length > 5
"
```

#### Scenario 3: Duplicate Injection Prevention
```bash
# Navigate to page
node test/scripts/interact.mjs navigate "https://example.com"

# Check guard (should be true)
node test/scripts/interact.mjs exec "window.__pageScopeInitialized"

# Try to inject again (should be prevented)
# Manually re-run sidebar Load - should see "already initialized" in logs
```

#### Scenario 4: Layout Thrashing (Performance)
```bash
# On page with many interactive elements (100+)
node test/scripts/interact.mjs navigate "https://github.com"

# Get UUID and open sidebar
UUID=$(node test/scripts/test-extension.mjs uuid)
node test/scripts/interact.mjs navigate "moz-extension://$UUID/sidebar/sidebar.html"

# Extract data
node test/scripts/interact.mjs click "#refresh"
node test/scripts/interact.mjs wait 3000

# Measure highlight performance
node test/scripts/interact.mjs exec "performance.mark('start')"
node test/scripts/interact.mjs click "#highlight-all"
node test/scripts/interact.mjs wait 500
node test/scripts/interact.mjs exec "
  performance.mark('end');
  performance.measure('highlight', 'start', 'end').duration
"
# Should be <100ms
```

---

## Debugging Commands

### Check Content Script Status
```bash
# Is content script loaded?
node test/scripts/interact.mjs exec "window.__pageScopeInitialized"

# Test ping handler
node test/scripts/interact.mjs exec "
  browser.runtime.sendMessage({ action: 'ping' })
    .then(r => r?.status)
"
```

### Inspect Extension State
```bash
# Get browser storage
node test/scripts/test-extension.mjs storage

# Execute in background context
node test/scripts/test-extension.mjs bg "
  browser.storage.local.get().then(console.log)
"

# Get extension UUID
node test/scripts/test-extension.mjs uuid
```

### Browser Console Logs
```bash
# View page console
node test/scripts/interact.mjs exec "console.log('test')"

# Check for errors
node test/scripts/interact.mjs exec "
  console.error.toString()
"
```

### Take Screenshots
```bash
# Full page screenshot
node test/scripts/interact.mjs screenshot --full debug-fullpage.png

# Viewport screenshot
node test/scripts/interact.mjs screenshot debug-viewport.png
```

### Inspect DOM
```bash
# Check for specific elements
node test/scripts/interact.mjs exec "
  document.querySelectorAll('.pagescope-highlight').length
"

# Get element text
node test/scripts/interact.mjs text "#some-selector"

# Get attribute
node test/scripts/interact.mjs attr "#some-selector" "data-id"
```

---

## Code Architecture

### Content Script (content.js)

**Key Classes:**
- `PageScope` - Main extraction engine

**Key Methods:**
```javascript
extract(options)              // Main entry point
getTextBlocks()               // Line 340: Queue-based shadow DOM traversal
getInteractive()              // Line 235: Interactive element extraction
getSemanticStructure()        // Line 972: Landmarks, headings, sections
getBrailleMap()               // Line 1486: Spatial grid representation
getDirectText(el)             // Line 903: TreeWalker text extraction
extractCodeBlocks(el)         // Line 936: Code block extraction
highlightElements(ids)        // Line 2080: Visual highlighting
```

**Critical Sections:**
- Lines 31-34: Duplicate injection guard
- Lines 340-475: Text block extraction (shadow DOM)
- Lines 903-923: TreeWalker implementation
- Lines 2025-2065: Message handlers (ping, extract, highlight)
- Lines 2099-2131: Batched highlight rendering

### Sidebar (sidebar/sidebar.js)

**Key Classes:**
- `PageScopeUI` - UI controller

**Key Methods:**
```javascript
refresh()                     // Line 110: Trigger extraction
updateUI(data)                // Line 147: Render extracted data
exportMarkdown()              // Line 879: MD export
exportJSON()                  // Line 727: JSON export
renderFencedCodeBlock()       // Line 853: Code fence generation
```

**Critical Sections:**
- Lines 116-131: Ping-check before injection
- Lines 853-862: Simplified fence rendering
- Lines 972-1009: Hash-based text block deduplication

### Background (background.js)

**Simple:**
- Lines 8-31: Toolbar click handler
- Toggles sidebar + injects content script

---

## Common Debug Patterns

### Pattern 1: Content Script Not Loading
**Symptoms:**
- Sidebar shows empty state after clicking Load
- Ping returns error
- `window.__pageScopeInitialized` is undefined

**Debug:**
```bash
# Check if injected
node test/scripts/interact.mjs exec "window.__pageScopeInitialized"

# Check page restrictions
node test/scripts/interact.mjs url
# Can't inject on: about:*, chrome:*, moz-extension:*, file://

# Check console for errors
node test/scripts/interact.mjs exec "console.log('test')"
```

### Pattern 2: Extraction Returns Empty Data
**Symptoms:**
- Load button clicked but no data appears
- Zero landmarks/sections/text blocks

**Debug:**
```bash
# Check page has content
node test/scripts/interact.mjs exec "document.body.innerHTML.length"

# Check visibility
node test/scripts/interact.mjs exec "
  document.querySelector('main, article, section')?.getBoundingClientRect()
"

# Manual extraction test
node test/scripts/interact.mjs exec "
  document.querySelectorAll('h1, h2, h3, p').length
"
```

### Pattern 3: Shadow DOM Not Working
**Symptoms:**
- Text blocks missing on sites with Web Components
- AI Studio chat content not extracted

**Debug:**
```bash
# Check for shadow roots
node test/scripts/interact.mjs exec "
  Array.from(document.querySelectorAll('*'))
    .filter(el => el.shadowRoot).length
"

# Test queue traversal
node test/scripts/interact.mjs exec "
  const queue = [document.body];
  const visited = new WeakSet();
  let shadowCount = 0;
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visited.has(node)) continue;
    visited.add(node);
    if (node.shadowRoot) shadowCount++;
    if (node.children) queue.push(...node.children);
  }
  shadowCount;
"
```

### Pattern 4: Performance Issues
**Symptoms:**
- Slow extraction (>5 seconds)
- Browser freezes
- High CPU usage

**Debug:**
```bash
# Profile extraction
node test/scripts/interact.mjs exec "
  performance.mark('extract-start');
  // Then click Load button
"

node test/scripts/interact.mjs exec "
  performance.mark('extract-end');
  performance.measure('extract', 'extract-start', 'extract-end').duration
"

# Check element count
node test/scripts/interact.mjs exec "
  document.querySelectorAll('*').length
"

# Check for infinite loops
# Look for hung processes in top/htop
```

---

## Environment Info

**System:**
- OS: Linux (Arch)
- Firefox: 146.0 (stable) + firefox-nightly
- Node.js: Required for test scripts (ESM support)
- Tools: nc (netcat), realpath, zip

**Paths:**
- Project: `/home/zack/dev/pagescope-extension`
- Build output: `dist/pagescope-v0.0.6.xpi`
- Test temp: `/tmp/tmp.*` (created by launch.sh)

**Ports:**
- Marionette: `localhost:2828`

---

## Build & Install

### Build XPI
```bash
cd /home/zack/dev/pagescope-extension
bash build.sh
# Output: dist/pagescope-v0.0.6.xpi (42KB)
```

### Manual Install (about:debugging)
1. Open Firefox
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `dist/pagescope-v0.0.6.xpi` or `manifest.json`

### Test Install (via Marionette)
```bash
# Automatic via launch.sh
test/scripts/launch.sh .
```

---

## Next Steps for Debugging

### Priority 1: Verify Core Fixes Work
- [ ] Duplicate injection guard prevents multiple instances
- [ ] Ping handler responds correctly
- [ ] Shadow DOM text extraction works (test on AI Studio)
- [ ] No duplicate code blocks in nested sections
- [ ] Text blocks appear in export (not suppressed)
- [ ] Layout doesn't thrash during highlight rendering

### Priority 2: Test Edge Cases
- [ ] Pages with no semantic structure (pure divs)
- [ ] Pages with 1000+ interactive elements
- [ ] Pages with deeply nested shadow DOM (>5 levels)
- [ ] Pages with iframes
- [ ] Pages with SVG/canvas content
- [ ] Restricted pages (about:*, chrome:*)

### Priority 3: Performance Validation
- [ ] Extraction completes <2s on typical page
- [ ] Highlight rendering <100ms for 100 elements
- [ ] Memory usage stable (no leaks)
- [ ] No forced synchronous layout warnings in DevTools

### Priority 4: Export Functionality
- [ ] JSON export includes all data
- [ ] Markdown export formats correctly
- [ ] Code blocks use correct fence length
- [ ] Text blocks deduplicated properly
- [ ] Downloads work correctly

---

## Key Questions to Answer

1. **Does the duplicate injection guard work?**
   - Test: Click Load multiple times, check `window.__pageScopeInitialized` stays true (not duplicated)

2. **Does ping handler work correctly?**
   - Test: Send ping message before and after injection, verify response

3. **Is shadow DOM text extraction working?**
   - Test: Navigate to aistudio.google.com, extract, verify chat messages appear

4. **Are code blocks still duplicated?**
   - Test: Page with nested section>article>pre, export JSON, check code blocks

5. **Do text blocks appear in export?**
   - Test: Extract page, export MD, verify "Additional Text Blocks" section exists

6. **Is highlight rendering performant?**
   - Test: Large page (100+ elements), measure highlight duration, should be <100ms

7. **Does the extension work on first install?**
   - Test: Fresh profile, install extension, verify sidebar works immediately

8. **Do exports download correctly?**
   - Test: Export JSON/MD/TXT, verify files download with correct content

---

## Contact / Handback

When debugging is complete, document:
1. What you tested
2. What works
3. What's broken (if anything)
4. Proposed fixes
5. New test cases to add

Files to check before handback:
- [ ] `dist/pagescope-v0.0.6.xpi` builds successfully
- [ ] `test/verify-fixes.sh` passes all checks
- [ ] No console errors on basic extraction
- [ ] Screenshots saved to `test/` directory

Good luck debugging! 🐛
