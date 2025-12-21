/**
 * PageScope - Background Script (MV3)
 * Handles extension initialization and toolbar button
 */

// Listen for toolbar button clicks (MV3: action API)
browser.action.onClicked.addListener(() => {
  browser.sidebarAction.open();
});
