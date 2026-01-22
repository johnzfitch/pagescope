document.getElementById('open-sidebar').addEventListener('click', () => {
  browser.sidebarAction.open();
  window.close();
});
