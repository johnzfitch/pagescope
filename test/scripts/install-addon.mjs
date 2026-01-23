#!/usr/bin/env node
// install-addon.mjs - Install extension via Marionette

import { Marionette } from './marionette.mjs';
import path from 'path';

async function main() {
  const extPath = process.argv[2];
  
  if (!extPath) {
    console.error('Usage: install-addon.mjs <extension-path>');
    process.exit(1);
  }

  const absolutePath = path.resolve(extPath);
  const m = new Marionette();

  try {
    await m.connect();
    await m.newSession();
    
    console.log(`Installing extension: ${absolutePath}`);
    const result = await m.installAddon(absolutePath, true);
    console.log(`Extension installed: ${result.value}`);
    
    await m.close();
  } catch (err) {
    console.error(`Failed to install extension: ${err.message}`);
    process.exit(1);
  }
}

main();
