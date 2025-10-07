# CodeMaster Testing Framework

## Overview

CodeMaster uses a comprehensive browser-based testing framework built into the Chrome extension's service worker. This allows for real-world testing of all extension functionality including database operations, Chrome APIs, and user workflows.

## Quick Start

### Essential Pre-Launch Tests
Run these commands in Chrome DevTools console (on the extension's background script):

```javascript
// 🚀 Complete production workflow test (NEW - Integration test)
await testProductionWorkflow({verbose: true})

// 🔧 Critical functionality verification
await runCriticalTests({verbose: true})

// 🏗️ Session creation verification (replaces manual database checking)
await testRealSessionCreation({verbose: true})

// 💾 Database persistence verification
await testDataPersistenceReliability({verbose: true})
```

## Test Categories

### 1. Integration Tests (NEW)
**Purpose**: Test complete user workflows end-to-end

```javascript
// NEW: Complete production workflow
testProductionWorkflow({verbose: true})  // Tests full user journey
```

**What it tests:**
- Session creation → Database persistence → Progression logic → Browser integration
- Replaces manual database verification
- Catches integration issues that unit tests miss

### 2. Unit Tests
**Purpose**: Test individual functions and algorithms

```javascript
// Algorithm testing
testDifficultyProgression({verbose: true})    // Progression logic
testEscapeHatches({verbose: true})            // Escape hatch logic
testTagIntegration({verbose: true})           // Tag system integration

// Service testing
testCoreServiceAvailability({verbose: true}) // Service availability
testDataPersistenceReliability({verbose: true}) // Database operations
```

### 3. Browser Integration Tests
**Purpose**: Test Chrome extension functionality

```javascript
// Phase 0: Critical browser tests
runPhase0Tests({verbose: true})

// Individual browser tests
testExtensionLoadOnLeetCode({verbose: true})       // Extension loading
testBackgroundScriptCommunication({verbose: true}) // Service worker messaging
testContentScriptInjection({verbose: true})       // Content script injection
```

### 4. Real System Tests
**Purpose**: Test with actual database and service integration

```javascript
// Real system testing
testRealSessionCreation({verbose: true})      // Actual session creation
testRealLearningFlow({verbose: true})        // Complete learning workflow
testRealFocusCoordination({verbose: true})   // Focus area coordination
```

## Test Phases

### Phase 0: Browser Integration (Critical for Launch)
```javascript
runPhase0Tests({verbose: true})
```
**Tests**: Extension loading, service worker communication, content script injection, settings persistence

**Why Critical**: These failures cause immediate user abandonment ("extension doesn't work")

### Phase 1: User Workflows
```javascript
runPhase1Tests({verbose: true})
```
**Tests**: Hint interaction, problem navigation, focus area selection, onboarding, submission tracking

### Phase 2: Algorithm & Learning
```javascript
runPhase2Tests({verbose: true})
```
**Tests**: Difficulty progression, escape hatches, session generation, relationship learning, tag integration

### Phase 3: Experience Quality
```javascript
runPhase3Tests({verbose: true})
```
**Tests**: Data persistence, UI responsiveness, accessibility compliance

## Comprehensive Test Suites

### All Tests (55+ individual tests)
```javascript
runAllTests({verbose: true})        // All tests with detailed output
runAllTests({silent: true})         // All tests, summary only
```

### Production-Ready Tests
```javascript
runProductionTests({verbose: true}) // Essential production readiness tests
runCriticalTests({verbose: true})   // Critical functionality only
```

### Development Tests
```javascript
runDevTests()                       // Development-focused test subset
```

## Test Development Guidelines

### Service Worker Constraints
- All tests run in Chrome extension service worker context
- No external testing frameworks (Playwright, Selenium, etc.)
- Direct access to Chrome APIs and IndexedDB
- Tests use existing service architecture

### CodeMaster Constraints
- ✅ **Use existing functions**: Chain existing test functions, don't create new ones
- ✅ **Static imports only**: No dynamic imports (`await import()`)
- ✅ **Chrome messaging pattern**: Follow established background script communication
- ✅ **Minimal additions**: Focus on integration, not new functionality
- ❌ **No new services**: Don't create new hooks or services unless explicitly requested
- ❌ **No overhauls**: Only focused, minimal fixes

### Adding New Tests
1. **Check existing functions first**: Can existing test functions be adapted?
2. **Use integration approach**: Chain existing tests rather than creating new ones
3. **Follow naming convention**: `testFeatureName({verbose: true})`
4. **Add to appropriate phase**: Place in correct test phase category
5. **Update documentation**: Add to this file and test registry

## Test Results Interpretation

### Success Indicators
```
✅ PRODUCTION WORKFLOW READY
📊 Results: 4/4 steps passed (100.0%)
⏱️ Duration: 1247ms
📝 Summary: Production workflow verified: 4/4 steps passed (100.0%) in 1247ms
```

### Failure Indicators
```
❌ PRODUCTION WORKFLOW ISSUES FOUND
📊 Results: 2/4 steps passed (50.0%)
🚨 Issues Found:
   1. Session creation failed
   2. Database verification failed
⏱️ Duration: 856ms
```

### Common Issue Resolution
- **Session creation failed**: Check service availability, database connection
- **Database verification failed**: Check IndexedDB permissions, data corruption
- **Progression logic failed**: Check algorithm functions, state management
- **Browser integration failed**: Check Chrome permissions, content script loading

## Database Testing Strategy

### What We Test
- **18 IndexedDB Stores**: All database stores are tested for read/write operations
- **Service Integration**: All services properly access database through background script
- **Data Persistence**: Data survives browser restarts and tab closures
- **Write Verification**: Database writes are validated, not just assumed

### What Replaces Manual Testing
The `testProductionWorkflow()` function replaces the manual process of:
1. Creating sessions manually
2. Checking database contents manually
3. Verifying data persistence manually
4. Testing progression logic manually

## Performance Testing

### Response Time Targets
- **Unit tests**: < 100ms each
- **Integration tests**: < 2000ms total
- **Browser tests**: < 500ms each
- **Database operations**: < 50ms each

### Memory Testing
```javascript
testMemoryLeakPrevention({verbose: true})  // Memory leak detection
testUIResponsiveness({verbose: true})      // UI performance testing
```

## Troubleshooting Tests

### Service Worker Not Active
1. Check Chrome extension is loaded
2. Verify background script is running
3. Check for JavaScript errors in service worker
4. Reload extension if necessary

### Test Function Not Found
```javascript
// Check available test functions
listAvailableTests()

// Check test registry
getTestsByCategory('critical')
```

### Database Connection Issues
```javascript
// Test database access
testCoreServiceAvailability({verbose: true})

// Test specific database operations
testDataPersistenceReliability({verbose: true})
```

## Test Coverage Analysis

### ✅ Well Covered
- Algorithm logic (difficulty progression, escape hatches)
- Service availability and integration
- Database read/write operations
- Browser extension loading
- Chrome API functionality

### 🔄 Recently Improved
- **Integration testing**: Added `testProductionWorkflow()` for end-to-end validation
- **Service reference resolution**: Fixed globalThis service exports
- **Test result clarity**: Added verbose output with clear pass/fail indicators

### 📈 Coverage Statistics
- **55+ individual tests** covering all major functionality
- **6 test phases** from critical browser integration to advanced features
- **4-step integration test** covering complete user workflow
- **18 database stores** all tested for persistence and integrity

## Future Testing Improvements

### Potential Enhancements (when constraints allow)
- End-to-end user scenario testing
- Cross-browser compatibility testing
- Performance regression testing
- Automated test scheduling

### Current Limitations
- No external testing frameworks due to service worker constraints
- Manual test execution (no CI/CD integration yet)
- Browser-dependent (requires Chrome extension context)

---

*Last updated: 2025-01-25 - Added testProductionWorkflow integration test*