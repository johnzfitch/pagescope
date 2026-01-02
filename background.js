/**
 * PageScope - Background Script (MV3)
 * Handles extension initialization and toolbar button
 */

// Listen for toolbar button clicks (MV3: action API)
// Inject content script and toggle sidebar
browser.action.onClicked.addListener(async (tab) => {
  console.log('[PageScope] Toolbar button clicked, tab:', tab.id);

  // Inject content script BEFORE toggling sidebar (uses activeTab permission)
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

  // Use toggle() which works more reliably in Firefox 131+ sidebar revamp
  try {
    await browser.sidebarAction.toggle();
    console.log('[PageScope] Sidebar toggled');
  } catch (e) {
    console.error('[PageScope] sidebarAction.toggle() failed:', e.message);
    // Fallback: try open() directly
    try {
      await browser.sidebarAction.open();
      console.log('[PageScope] Sidebar opened via fallback');
    } catch (e2) {
      console.error('[PageScope] sidebarAction.open() also failed:', e2.message);
    }
  }
});
