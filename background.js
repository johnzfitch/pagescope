/**
 * PageScope - Background Script (MV3)
 * Handles extension initialization and toolbar button
 */

// Listen for toolbar button clicks (MV3: action API)
// Toggle sidebar FIRST (must be synchronous), then inject script
browser.action.onClicked.addListener(async (tab) => {
  console.log('[PageScope] Toolbar button clicked, tab:', tab.id);

  // CRITICAL: Toggle sidebar FIRST, synchronously, before any await
  // Firefox requires sidebarAction calls within user input handler context
  try {
    browser.sidebarAction.toggle();
    console.log('[PageScope] Sidebar toggle initiated');
  } catch (e) {
    console.error('[PageScope] sidebarAction.toggle() failed:', e.message);
  }

  // THEN inject content script (async, after sidebar toggle)
  try {
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    console.log('[PageScope] Content script injected from background');
  } catch (e) {
    console.log('[PageScope] Content script injection note:', e.message);
    // Script might already be injected or page is restricted - sidebar will handle it
  }
});
