/**
 * Production Background Script - Chrome Extension Service Worker
 *
 * PRODUCTION BUILD - NO TEST FUNCTIONS OR DEBUG UTILITIES
 *
 * This is the clean production entry point that excludes:
 * - Test utilities and functions
 * - Debug helpers
 * - Development-only message handlers
 *
 * For development with tests, use background.development.js
 */

// Import the main background script functionality
// The actual handlers are in ./index.js
// This file serves as the production entry point that webpack will bundle

console.log('🚀 PRODUCTION: Background script initializing...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('🏭 Build mode: PRODUCTION');

// Mark this as production context
globalThis.IS_PRODUCTION_BUILD = true;
globalThis.ENABLE_TEST_FUNCTIONS = false;

// Load the main background script
import './index.js';

console.log('✅ PRODUCTION: Background script loaded');
