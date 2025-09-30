/**
 * Development Background Script - Chrome Extension Service Worker
 *
 * DEVELOPMENT BUILD - INCLUDES TEST FUNCTIONS AND DEBUG UTILITIES
 *
 * This development entry point includes:
 * - Test utilities and functions
 * - Debug helpers
 * - Development-only message handlers
 * - Console logging for debugging
 *
 * For production builds, use background.production.js
 */

console.log('🚀 DEVELOPMENT: Background script initializing...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 Build mode: DEVELOPMENT');

// Mark this as development context
globalThis.IS_PRODUCTION_BUILD = false;
globalThis.ENABLE_TEST_FUNCTIONS = true;

// Load the main background script
require('../../public/background.js');

console.log('✅ DEVELOPMENT: Background script loaded with test functions enabled');