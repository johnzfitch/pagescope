# PageScope Changelog

## [0.0.6] - 2026-01-23

### Fixed Browser Performance & Security Issues

#### Removed
- Unused `vendor/shadow-dom-selector.js` library (11KB dead code)
- Unused `tabs` permission from manifest
- Automatic content script injection via `content_scripts` (now programmatic only)

#### Added
- Duplicate injection guard (`window.__pageScopeInitialized`)
- Ping handler in content script for injection verification
- Sidebar ping-check before injection to prevent duplicates
- E2E testing infrastructure using Firefox Marionette protocol
  - `test/scripts/marionette.mjs` - Protocol client (zero deps)
  - `test/scripts/interact.mjs` - CLI automation
  - `test/scripts/test-extension.mjs` - Extension utilities
  - `test/quick-test.sh` - Quick test launcher
  - `test/verify-fixes.sh` - MVP fix verification

#### Optimized
- **getDirectText()**: Replaced clone + 4× querySelectorAll with TreeWalker (single-pass)
- **extractCodeBlocks()**: Direct scan with closest() check instead of cloning
- **highlightElements()**: Batched getBoundingClientRect → DocumentFragment writes (fixes layout thrashing)
- **renderFencedCodeBlock()**: Simple includes('```') check vs regex matchAll
- **Text block deduplication**: First 200 chars hash instead of full text in Set
- **Heading redundancy check**: Precomputed key, clearer logic
- **Shadow DOM traversal**: Queue-based iteration for text extraction

#### Changed
- Content script now programmatic injection only (no auto-load overhead)
- Injection model: toolbar click → background.js → sidebar ping-check → inject if needed
- Updated header comments to reflect new injection model

### Performance Gains

- **Package size**: 48K → 44K (9% reduction)
- **Permissions**: Narrowed to `activeTab`, `storage`, `scripting` only
- **DOM operations**: O(n) single traversals vs O(n×m) multi-pass
- **Memory**: Hash-based deduplication (~200 bytes/entry vs full text)
- **Layout**: No forced synchronous layout in highlight rendering

### Security Improvements

- Removed broad `tabs` permission
- No automatic content script injection on all URLs
- On-demand programmatic injection via user action only

### Testing

Complete E2E test infrastructure with:
- Native Firefox Marionette protocol (no Selenium/geckodriver)
- Extension background script execution
- Browser storage access
- Screenshot capture
- Zero external dependencies

## [0.0.5] - Previous

Initial release with structure extraction, interactive elements, and export features.

---

For detailed testing instructions, see [TESTING.md](TESTING.md).
