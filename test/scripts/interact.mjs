#!/usr/bin/env node
// interact.mjs - CLI for Firefox Marionette interaction

import { Marionette } from './marionette.mjs';
import fs from 'fs';
import path from 'path';

const HELP = `
Usage: interact.mjs <command> [args...]

Commands:
  navigate <url>              Load URL
  url                         Get current URL
  title                       Get page title
  screenshot <file.png>       Capture viewport (or full page with --full)
  click <selector>            Click element by CSS selector
  type <selector> <text>      Type text into element
  clear <selector>            Clear input element
  text <selector>             Get element text content
  attr <selector> <name>      Get element attribute
  exec <js>                   Execute JS in page, print result
  exec-chrome <js>            Execute JS in chrome context
  wait <ms>                   Sleep for milliseconds
  back                        Navigate back
  forward                     Navigate forward
  refresh                     Refresh page
  resize <width> <height>     Set window size
  size                        Get window size
  quit                        Close Firefox

Options:
  --full                      Full page screenshot
  --host <host>               Marionette host (default: localhost)
  --port <port>               Marionette port (default: 2828)

Examples:
  interact.mjs navigate "https://example.com"
  interact.mjs screenshot page.png --full
  interact.mjs click "#submit-button"
  interact.mjs exec "document.querySelectorAll('a').length"
`;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  // Parse options
  let host = 'localhost';
  let port = 2828;
  let full = false;
  
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) {
      host = args[++i];
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[++i], 10);
    } else if (args[i] === '--full') {
      full = true;
    } else {
      positional.push(args[i]);
    }
  }

  const [command, ...cmdArgs] = positional;

  const m = new Marionette(host, port);
  
  try {
    await m.connect();
    await m.newSession();

    switch (command) {
      case 'navigate':
      case 'goto':
      case 'go': {
        const url = cmdArgs[0];
        if (!url) throw new Error('URL required');
        await m.navigate(url);
        console.log(`Navigated to: ${url}`);
        break;
      }

      case 'url': {
        const url = await m.getCurrentUrl();
        console.log(url.value);
        break;
      }

      case 'title': {
        const title = await m.getTitle();
        console.log(title.value);
        break;
      }

      case 'screenshot':
      case 'ss': {
        const file = cmdArgs[0] || 'screenshot.png';
        const base64 = await m.screenshot(null, full);
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(file, buffer);
        console.log(`Screenshot saved: ${path.resolve(file)} (${buffer.length} bytes)`);
        break;
      }

      case 'click': {
        const selector = cmdArgs[0];
        if (!selector) throw new Error('Selector required');
        const el = await m.findElement('css selector', selector);
        await m.clickElement(el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf']);
        console.log(`Clicked: ${selector}`);
        break;
      }

      case 'type': {
        const selector = cmdArgs[0];
        const text = cmdArgs.slice(1).join(' ');
        if (!selector || !text) throw new Error('Selector and text required');
        const el = await m.findElement('css selector', selector);
        const elId = el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf'];
        await m.sendKeysToElement(elId, text);
        console.log(`Typed "${text}" into: ${selector}`);
        break;
      }

      case 'clear': {
        const selector = cmdArgs[0];
        if (!selector) throw new Error('Selector required');
        const el = await m.findElement('css selector', selector);
        await m.clearElement(el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf']);
        console.log(`Cleared: ${selector}`);
        break;
      }

      case 'text': {
        const selector = cmdArgs[0];
        if (!selector) throw new Error('Selector required');
        const el = await m.findElement('css selector', selector);
        const text = await m.getElementText(el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf']);
        console.log(text.value);
        break;
      }

      case 'attr': {
        const selector = cmdArgs[0];
        const attrName = cmdArgs[1];
        if (!selector || !attrName) throw new Error('Selector and attribute name required');
        const el = await m.findElement('css selector', selector);
        const val = await m.getElementAttribute(
          el.value.ELEMENT || el.value['element-6066-11e4-a52e-4f735466cecf'],
          attrName
        );
        console.log(val.value);
        break;
      }

      case 'exec':
      case 'js': {
        const script = cmdArgs.join(' ');
        if (!script) throw new Error('Script required');
        const result = await m.executeScript(`return (${script})`);
        console.log(JSON.stringify(result.value, null, 2));
        break;
      }

      case 'exec-chrome':
      case 'chrome': {
        const script = cmdArgs.join(' ');
        if (!script) throw new Error('Script required');
        await m.setContext('chrome');
        const result = await m.executeScript(`return (${script})`);
        await m.setContext('content');
        console.log(JSON.stringify(result.value, null, 2));
        break;
      }

      case 'wait':
      case 'sleep': {
        const ms = parseInt(cmdArgs[0] || '1000', 10);
        await new Promise(r => setTimeout(r, ms));
        console.log(`Waited ${ms}ms`);
        break;
      }

      case 'back': {
        await m.back();
        console.log('Navigated back');
        break;
      }

      case 'forward': {
        await m.forward();
        console.log('Navigated forward');
        break;
      }

      case 'refresh': {
        await m.refresh();
        console.log('Refreshed');
        break;
      }

      case 'resize': {
        const width = parseInt(cmdArgs[0], 10);
        const height = parseInt(cmdArgs[1], 10);
        if (!width || !height) throw new Error('Width and height required');
        await m.setWindowRect(width, height);
        console.log(`Resized to: ${width}x${height}`);
        break;
      }

      case 'size': {
        const rect = await m.getWindowRect();
        console.log(`${rect.width}x${rect.height} at (${rect.x}, ${rect.y})`);
        break;
      }

      case 'quit':
      case 'close': {
        await m.quit();
        console.log('Firefox closed');
        return; // Skip normal close
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }

    await m.close();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
