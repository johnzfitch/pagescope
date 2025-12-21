/**
 * PageScope - Background Script
 * Handles extension initialization and toolbar button
 */

// Listen for toolbar button clicks
browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.open();
});
