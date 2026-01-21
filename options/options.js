/**
 * PageScope - Options/Settings
 */

class OptionsUI {
  constructor() {
    this.init();
  }
  
  async init() {
    await this.loadSettings();
    this.setupEventListeners();
  }
  
  async loadSettings() {
    const settings = await browser.storage.local.get({
      autoRefresh: false,
      brailleResolution: 'standard'
    });

    const autoRefreshEl = document.getElementById('auto-refresh');
    if (autoRefreshEl) {
      autoRefreshEl.checked = settings.autoRefresh;
    }

    // Set Braille resolution radio buttons
    const resolutionRadio = document.querySelector(`input[name="braille-resolution"][value="${settings.brailleResolution}"]`);
    if (resolutionRadio) {
      resolutionRadio.checked = true;
    }
  }

  setupEventListeners() {
    const saveBtn = document.getElementById('save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveSettings();
      });
    }
  }

  async saveSettings() {
    const autoRefreshEl = document.getElementById('auto-refresh');
    const brailleResolutionEl = document.querySelector('input[name="braille-resolution"]:checked');

    const settings = {
      autoRefresh: autoRefreshEl ? autoRefreshEl.checked : false,
      brailleResolution: brailleResolutionEl ? brailleResolutionEl.value : 'standard'
    };

    try {
      await browser.storage.local.set(settings);

      await browser.runtime.sendMessage({
        action: 'settingsChanged',
        settings
      });

      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }
  
  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `show ${type}`;
    
    setTimeout(() => {
      status.classList.remove('show');
    }, 3000);
  }
}

new OptionsUI();
