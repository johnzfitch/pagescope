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
      mcpEnabled: false
    });
    
    document.getElementById('auto-refresh').checked = settings.autoRefresh;
    document.getElementById('mcp-enabled').checked = settings.mcpEnabled;
    
    this.toggleMCPSetup(settings.mcpEnabled);
  }
  
  setupEventListeners() {
    document.getElementById('mcp-enabled').addEventListener('change', (e) => {
      this.toggleMCPSetup(e.target.checked);
    });
    
    document.getElementById('save').addEventListener('click', () => {
      this.saveSettings();
    });
  }
  
  toggleMCPSetup(enabled) {
    const setup = document.getElementById('mcp-setup');
    setup.style.display = enabled ? 'block' : 'none';
  }
  
  async saveSettings() {
    const settings = {
      autoRefresh: document.getElementById('auto-refresh').checked,
      mcpEnabled: document.getElementById('mcp-enabled').checked
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
