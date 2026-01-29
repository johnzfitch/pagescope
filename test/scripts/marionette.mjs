// marionette.mjs - Firefox Marionette protocol client
// Direct TCP connection, no external deps

import net from 'net';

export class Marionette {
  constructor(host = 'localhost', port = 2828) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.msgId = 0;
    this.sessionId = null;
    this.buffer = '';
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        // Wait for hello
        this.socket.once('data', (data) => {
          const hello = this._parseResponse(data.toString());
          if (hello?.marionetteProtocol) {
            resolve(hello);
          } else {
            reject(new Error('Invalid Marionette hello'));
          }
        });
      });
      this.socket.on('error', reject);
    });
  }

  async newSession(capabilities = {}) {
    const resp = await this._send('WebDriver:NewSession', { capabilities });
    this.sessionId = resp.sessionId;
    return resp;
  }

  async navigate(url) {
    return this._send('WebDriver:Navigate', { url });
  }

  async getCurrentUrl() {
    return this._send('WebDriver:GetCurrentURL');
  }

  async getTitle() {
    return this._send('WebDriver:GetTitle');
  }

  async executeScript(script, args = [], sandbox = null) {
    const params = { script, args };
    if (sandbox) params.sandbox = sandbox;
    return this._send('WebDriver:ExecuteScript', params);
  }

  async executeAsyncScript(script, args = []) {
    return this._send('WebDriver:ExecuteAsyncScript', { script, args });
  }

  async findElement(using, value) {
    return this._send('WebDriver:FindElement', { using, value });
  }

  async findElements(using, value) {
    return this._send('WebDriver:FindElements', { using, value });
  }

  async clickElement(elementId) {
    return this._send('WebDriver:ElementClick', { id: elementId });
  }

  async sendKeysToElement(elementId, text) {
    return this._send('WebDriver:ElementSendKeys', { id: elementId, text });
  }

  async clearElement(elementId) {
    return this._send('WebDriver:ElementClear', { id: elementId });
  }

  async getElementText(elementId) {
    return this._send('WebDriver:GetElementText', { id: elementId });
  }

  async getElementAttribute(elementId, name) {
    return this._send('WebDriver:GetElementAttribute', { id: elementId, name });
  }

  async screenshot(elementId = null, full = false) {
    const params = { full };
    if (elementId) params.id = elementId;
    const resp = await this._send('WebDriver:TakeScreenshot', params);
    return resp.value;
  }

  async setWindowRect(width, height, x = null, y = null) {
    const params = { width, height };
    if (x !== null) params.x = x;
    if (y !== null) params.y = y;
    return this._send('WebDriver:SetWindowRect', params);
  }

  async getWindowRect() {
    return this._send('WebDriver:GetWindowRect');
  }

  async back() {
    return this._send('WebDriver:Back');
  }

  async forward() {
    return this._send('WebDriver:Forward');
  }

  async refresh() {
    return this._send('WebDriver:Refresh');
  }

  // Addon management
  async installAddon(path, temporary = true) {
    return this._send('Addon:Install', { path, temporary });
  }

  async uninstallAddon(id) {
    return this._send('Addon:Uninstall', { id });
  }

  // Context switching (for extension access)
  async getContext() {
    return this._send('Marionette:GetContext');
  }

  async setContext(context) {
    // context: 'content' or 'chrome'
    return this._send('Marionette:SetContext', { value: context });
  }

  async close() {
    if (this.sessionId) {
      try {
        await this._send('WebDriver:DeleteSession');
      } catch (e) {
        // Ignore close errors
      }
    }
    this.socket?.destroy();
    this.socket = null;
    this.sessionId = null;
  }

  async quit() {
    try {
      await this._send('Marionette:Quit', { flags: ['eForceQuit'] });
    } catch (e) {
      // Expected - connection closes
    }
  }

  // Internal protocol handling
  _parseResponse(data) {
    // Marionette framing: length:json
    const colonIdx = data.indexOf(':');
    if (colonIdx === -1) return null;
    const len = parseInt(data.slice(0, colonIdx), 10);
    const json = data.slice(colonIdx + 1, colonIdx + 1 + len);
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  async _send(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      const msg = [0, id, command, params];
      const json = JSON.stringify(msg);
      // Use Buffer.byteLength for correct byte count with non-ASCII characters
      const frame = `${Buffer.byteLength(json, 'utf8')}:${json}`;

      let responseData = Buffer.alloc(0);

      const onData = (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);

        // Try to parse complete response
        const colonIdx = responseData.indexOf(':'.charCodeAt(0));
        if (colonIdx === -1) return;

        const len = parseInt(responseData.slice(0, colonIdx).toString(), 10);
        const expectedEnd = colonIdx + 1 + len;

        if (responseData.length >= expectedEnd) {
          this.socket.removeListener('data', onData);

          const json = responseData.slice(colonIdx + 1, expectedEnd).toString('utf8');
          try {
            const [, , error, result] = JSON.parse(json);

            if (error) {
              reject(new Error(`${error.error}: ${error.message}`));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        }
      };

      this.socket.on('data', onData);
      this.socket.write(frame);
    });
  }
}

export default Marionette;
