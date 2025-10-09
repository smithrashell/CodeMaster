/**
 * Development Background Script - Chrome Extension Service Worker
 *
 * DEVELOPMENT BUILD - INCLUDES TEST FUNCTIONS AND DEBUG UTILITIES
 */

console.warn('🚀🚀🚀 DEVELOPMENT: Background script initializing...');
console.warn('⏰⏰⏰ BUILD_TIMESTAMP:', BUILD_TIMESTAMP);
console.warn('📦 NODE_ENV:', process.env.NODE_ENV);
console.warn('🔧 Build mode: DEVELOPMENT');

// Mark this as development context
globalThis.IS_PRODUCTION_BUILD = false;
globalThis.ENABLE_TEST_FUNCTIONS = true;

// Load the main background script (unminified source)
import '../../public/background-original.js';

// Load test functions and initialize them
import { initializeCoreBusinessTests } from './core-business-tests.js';
initializeCoreBusinessTests();

console.log('✅ DEVELOPMENT: Background script loaded with test functions enabled');
