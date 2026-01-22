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

    console.log('[Options] Saving settings:', settings);

    try {
      await browser.storage.local.set(settings);
      console.log('[Options] Settings saved to storage');

      // Try to notify background script, but don't fail if it errors
      try {
        await browser.runtime.sendMessage({
          action: 'settingsChanged',
          settings
        });
        console.log('[Options] Background script notified');
      } catch (msgError) {
        console.warn('[Options] Could not notify background script:', msgError);
        // This is OK - background script might not be listening
      }

      // Verify settings were actually saved
      const verified = await browser.storage.local.get(['autoRefresh', 'brailleResolution']);
      console.log('[Options] Verified saved settings:', verified);

      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('[Options] Failed to save settings:', error);
      this.showStatus(`Failed to save settings: ${error.message}`, 'error');
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
