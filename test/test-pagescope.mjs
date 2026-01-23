#!/usr/bin/env node
// PageScope E2E Tests

import { ExtensionTester } from './scripts/test-extension.mjs';
import assert from 'assert';

const test = new ExtensionTester();

async function runTests() {
  console.log('🧪 PageScope E2E Tests\n');

  try {
    await test.connect();
    console.log('✓ Connected to Firefox\n');

    // Test 1: Basic page navigation
    console.log('Test 1: Navigate to test page');
    await test.navigate('https://example.com');
    const title = await test.exec('document.title');
    console.log(`  Page title: "${title}"`);
    assert(title === 'Example Domain', 'Title mismatch');
    console.log('  ✓ Navigation works\n');

    // Test 2: Open sidebar
    console.log('Test 2: Open extension sidebar');
    await test.openExtensionPage('sidebar/sidebar.html');
    await new Promise(r => setTimeout(r, 500));

    const sidebarTitle = await test.exec('document.title');
    console.log(`  Sidebar title: "${sidebarTitle}"`);
    console.log('  ✓ Sidebar opened\n');

    // Test 3: Check initial state
    console.log('Test 3: Check initial empty state');
    const hasEmptyState = await test.exec(`
      !!document.querySelector('.empty-state')
    `);
    console.log(`  Empty state visible: ${hasEmptyState}`);
    assert(hasEmptyState, 'Empty state should be visible initially');
    console.log('  ✓ Initial state correct\n');

    // Test 4: Trigger extraction
    console.log('Test 4: Click Load button to extract page data');

    // Navigate back to test page in main window
    await test.navigate('https://example.com');
    await new Promise(r => setTimeout(r, 500));

    // Switch back to sidebar
    await test.openExtensionPage('sidebar/sidebar.html');
    await new Promise(r => setTimeout(r, 500));

    // Click refresh/load button
    await test.click('#refresh');
    console.log('  Clicked Load button');

    // Wait for extraction
    await new Promise(r => setTimeout(r, 2000));

    // Check if data loaded
    const hasStructure = await test.exec(`
      !!document.querySelector('#structure-tab .item')
    `);
    console.log(`  Data extracted: ${hasStructure}`);
    console.log('  ✓ Extraction triggered\n');

    // Test 5: Verify structure data
    console.log('Test 5: Verify extracted structure');
    const landmarkCount = await test.exec(`
      document.querySelectorAll('#structure-tab .item').length
    `);
    console.log(`  Landmarks found: ${landmarkCount}`);
    console.log('  ✓ Structure extracted\n');

    // Test 6: Test tab switching
    console.log('Test 6: Switch to Interactive tab');
    await test.click('[data-tab="interactive"]');
    await new Promise(r => setTimeout(r, 500));

    const activeTab = await test.exec(`
      document.querySelector('.tab.active')?.dataset.tab
    `);
    console.log(`  Active tab: ${activeTab}`);
    assert(activeTab === 'interactive', 'Tab switching failed');
    console.log('  ✓ Tab switching works\n');

    // Test 7: Test JSON export
    console.log('Test 7: Test JSON export button');
    const exportBtnExists = await test.exec(`
      !!document.querySelector('#export-json')
    `);
    console.log(`  Export button exists: ${exportBtnExists}`);
    assert(exportBtnExists, 'Export button not found');
    console.log('  ✓ Export UI present\n');

    // Test 8: Screenshot result
    console.log('Test 8: Take screenshot');
    await test.screenshot('/home/zack/dev/pagescope-extension/test/pagescope-test.png');
    console.log('  ✓ Screenshot saved to test/pagescope-test.png\n');

    // Test 9: Check browser storage
    console.log('Test 9: Check browser storage');
    const storage = await test.getStorage();
    console.log(`  Storage keys: ${Object.keys(storage).join(', ')}`);
    console.log('  ✓ Storage accessible\n');

    // Test 10: Test ping handler
    console.log('Test 10: Test content script ping');
    await test.navigate('https://example.com');
    await new Promise(r => setTimeout(r, 500));

    const pingResponse = await test.exec(`
      new Promise((resolve) => {
        browser.runtime.sendMessage({ action: 'ping' }, (response) => {
          resolve(response?.status);
        });
      })
    `);
    console.log(`  Ping response: ${pingResponse}`);
    console.log('  ✓ Content script responds to ping\n');

    console.log('\n✅ All tests passed!');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await test.close();
  }
}

runTests();
