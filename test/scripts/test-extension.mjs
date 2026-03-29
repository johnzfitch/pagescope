#!/usr/bin/env node
// test-extension.mjs - Higher-level extension testing utilities

import { Marionette } from './marionette.mjs';
import fs from 'fs';

export class ExtensionTester {
  constructor(host = 'localhost', port = 2828) {
    this.m = new Marionette(host, port);
    this.extensionId = null;
    this.extensionUUID = null;
  }

  async connect() {
    await this.m.connect();
    await this.m.newSession();
    return this;
  }

  async close() {
    await this.m.close();
  }

  // Get extension internal UUID (needed for moz-extension:// URLs)
  async getExtensionUUID() {
    if (this.extensionUUID) return this.extensionUUID;
    
    await this.m.setContext('chrome');
    const result = await this.m.executeScript(`
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
      const addons = await AddonManager.getAllAddons();
      const tempAddons = addons.filter(a => a.temporarilyInstalled);
      return tempAddons.map(a => ({ id: a.id, name: a.name }));
    `);
    await this.m.setContext('content');
    
    if (result.value?.length > 0) {
      this.extensionId = result.value[0].id;
    }
    
    // Get UUID from about:debugging
    await this.m.navigate('about:debugging#/runtime/this-firefox');
    await new Promise(r => setTimeout(r, 1000));
    
    const uuidResult = await this.m.executeScript(`
      const items = document.querySelectorAll('.extension-uuid');
      return Array.from(items).map(el => el.textContent);
    `);
    
    if (uuidResult.value?.length > 0) {
      this.extensionUUID = uuidResult.value[0];
    }
    
    return this.extensionUUID;
  }

  // Navigate to extension page (popup, options, etc.)
  async openExtensionPage(pagePath) {
    const uuid = await this.getExtensionUUID();
    if (!uuid) throw new Error('Could not determine extension UUID');
    const url = `moz-extension://${uuid}/${pagePath}`;
    await this.m.navigate(url);
    return url;
  }

  // Execute script in extension background context
  async execInBackground(script) {
    await this.m.setContext('chrome');
    const result = await this.m.executeScript(`
      const { ExtensionParent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
      const ext = ExtensionParent.GlobalManager.extensionMap.values().next().value;
      if (!ext) throw new Error('No extension found');
      return ext.backgroundContext?.executeScript({code: \`${script.replace(/`/g, '\\`')}\`});
    `);
    await this.m.setContext('content');
    return result.value;
  }

  // Get browser.storage.local data
  async getStorage(keys = null) {
    const keyArg = keys ? JSON.stringify(keys) : 'null';
    return this.execInBackground(`browser.storage.local.get(${keyArg})`);
  }

  // Set browser.storage.local data
  async setStorage(data) {
    return this.execInBackground(`browser.storage.local.set(${JSON.stringify(data)})`);
  }

  // Clear browser.storage.local
  async clearStorage() {
    return this.execInBackground('browser.storage.local.clear()');
  }

  // Take screenshot and save
  async screenshot(filename, full = false) {
    const base64 = await this.m.screenshot(null, full);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filename, buffer);
    return filename;
  }

  // Wait for element to appear
  async waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const el = await this.m.findElement('css selector', selector);
        if (el.value) return el;
      } catch {
        // Element not found yet
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Element not found: ${selector} (timeout: ${timeout}ms)`);
  }

  // Click element by selector
  async click(selector) {
    const el = await this.m.findElement('css selector', selector);
    const elId = el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf'];
    await this.m.clickElement(elId);
  }

  // Type into element
  async type(selector, text) {
    const el = await this.m.findElement('css selector', selector);
    const elId = el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf'];
    await this.m.sendKeysToElement(elId, text);
  }

  // Get element text
  async getText(selector) {
    const el = await this.m.findElement('css selector', selector);
    const elId = el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf'];
    const result = await this.m.getElementText(elId);
    return result.value;
  }

  // Execute JS in page
  async exec(script) {
    const result = await this.m.executeScript(`return (${script})`);
    return result.value;
  }

  // Navigate to URL
  async navigate(url) {
    await this.m.navigate(url);
  }

  // Simple assertion helpers
  assert(condition, message) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , cmd, ...args] = process.argv;
  
  const tester = new ExtensionTester();
  
  (async () => {
    try {
      await tester.connect();
      
      switch (cmd) {
        case 'uuid':
          console.log(await tester.getExtensionUUID());
          break;
        case 'popup':
          console.log(await tester.openExtensionPage(args[0] || 'popup.html'));
          break;
        case 'storage':
          console.log(JSON.stringify(await tester.getStorage(), null, 2));
          break;
        case 'bg':
          console.log(await tester.execInBackground(args.join(' ')));
          break;
        default:
          console.log('Commands: uuid, popup [page], storage, bg <script>');
      }
      
      await tester.close();
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  })();
}

export default ExtensionTester;
