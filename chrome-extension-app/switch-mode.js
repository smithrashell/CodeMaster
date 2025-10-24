#!/usr/bin/env node

// Script to switch between production and testing modes
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'public', 'manifest.json');
const mode = process.argv[2];

if (!mode || !['production', 'testing'].includes(mode)) {
  console.log('Usage: node switch-mode.js [production|testing]');
  console.log('');
  console.log('Modes:');
  console.log('  production - Lean background script for end users');
  console.log('  testing    - Full comprehensive testing infrastructure');
  process.exit(1);
}

try {
  // Read current manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Update service worker
  const serviceWorkerFile = mode === 'production' ? 'background-production.js' : 'background.js';
  manifest.background.service_worker = serviceWorkerFile;

  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✅ Switched to ${mode} mode`);
  console.log(`📄 Service worker: ${serviceWorkerFile}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Run: npm run build');
  console.log('2. Reload the extension in chrome://extensions/');

  if (mode === 'production') {
    console.log('');
    console.log('📊 Production mode:');
    console.log('- Lean service worker (~500KB)');
    console.log('- Core Chrome extension functionality only');
    console.log('- Optimized for end users');
  } else {
    console.log('');
    console.log('🧪 Testing mode:');
    console.log('- Full comprehensive testing (~3MB)');
    console.log('- All test functions available');
    console.log('- Use: await runTestsSilent()');
  }

} catch (error) {
  console.error('❌ Error switching modes:', error.message);
  process.exit(1);
}