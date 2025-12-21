/**
 * PageScope - Background Script (MV3)
 * Handles extension initialization and toolbar button
 */

// Listen for toolbar button clicks (MV3: action API)
// Toggle sidebar - open if closed, close if open
browser.action.onClicked.addListener(async () => {
  const isOpen = await browser.sidebarAction.isOpen({});

  if (isOpen) {
    browser.sidebarAction.close();
  } else {
    browser.sidebarAction.open();
  }
});
