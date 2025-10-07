# 🧪 CodeMaster Testing Framework

CodeMaster includes a sophisticated testing framework designed for Chrome extension development with comprehensive database isolation, snapshot-based state management, and automatic test orchestration.

## 🎯 Quick Start

### Basic Testing Workflow

```javascript
// Browser console (after loading extension)
setupTests()                    // Start test session (one-time setup)
runMultipleTests()             // Run all tests with auto-isolation
endTestSession()               // Clean up when done
```

### Expected Output
```
✅ Test session initialization complete!
🚀 Starting multi-test execution (5 tests)
📋 [1/5] Running test: minimal
✅ [1/5] minimal completed (245ms)
📋 [2/5] Running test: core
✅ [2/5] core completed (892ms)
...
📊 MULTI-TEST SUMMARY
✅ Successful: 5/5
⏱️ Total Duration: 2.1s
📈 Success Rate: 100%
```

## 🏗️ Framework Architecture

### Key Design Principles

1. **🚀 Efficient**: One-time database seeding per session (not per test)
2. **⚡ Fast Isolation**: Snapshot-based restoration vs rebuilding relationships
3. **🤖 Automatic**: No manual state management required
4. **🔒 Safe**: Production database never touched during testing
5. **📊 Comprehensive**: Tests all core business logic and relationships

### Data Management Strategy

```javascript
// Data Categories for Smart Isolation
const DATA_CATEGORIES = {
  STATIC: [
    'standard_problems',    // ~3000+ problems, never changes
    'strategy_data',        // Algorithm strategy data
    'tag_relationships'     // Static tag graph
  ],
  EXPENSIVE_DERIVED: [
    'pattern_ladders',      // Expensive to rebuild
    'problem_relationships' // Modified by tests but expensive
  ],
  TEST_SESSION: [
    'sessions',             // Cleared between tests
    'attempts',             // Cleared between tests
    'tag_mastery',          // Cleared between tests
    'problems'              // Cleared between tests
  ]
};
```

## 🎛️ Advanced Usage

### Test Session Configuration

```javascript
await enableTesting({
  mode: 'session',         // 'session' | 'single' | 'persistent'
  seedLevel: 'full',       // 'minimal' | 'standard' | 'full'
  autoSnapshot: true,      // Create baseline snapshots for fast isolation
  force: false            // Force re-initialization even if session active
})
```

#### Configuration Options

| Option | Values | Description |
|--------|--------|-------------|
| `mode` | `session` (default) | Multi-test session with snapshots |
|        | `single` | One-off test execution |
|        | `persistent` | Keep session active indefinitely |
| `seedLevel` | `minimal` | Basic data only |
|             | `standard` | Core business data |
|             | `full` (default) | Complete production-like data |
| `autoSnapshot` | `true` (default) | Create snapshots after seeding |
|                 | `false` | Skip snapshot creation |

### Running Specific Tests

```javascript
// Run specific test categories
await runMultipleTests(['minimal', 'core'])

// Run individual tests
await testCoreBusinessLogic({ verbose: true })
await testMinimal()
await testRealRelationshipLearning()

// Available test categories
const availableTests = [
  'minimal',        // Basic session adaptation logic
  'core',           // Core business logic validation
  'relationships',  // Problem/tag relationship testing
  'onboarding',     // User initialization testing
  'sessionCreation' // Session lifecycle testing
];
```

### Session Management

```javascript
// Check session status
getTestSessionInfo()
/* Returns:
{
  active: true,
  sessionId: "session_1234567890_abc123",
  mode: "session",
  databaseActive: true,
  snapshotAvailable: true
}
*/

// End session with options
await endTestSession({
  clearDatabase: false,    // Whether to clear test database
  restoreProduction: true  // Whether to restore production access
})
```

## 🔬 Database Isolation & Snapshots

### How Isolation Works

1. **Database Intercept**: All database operations are automatically redirected to test database
2. **Proxy Layer**: Services use intercepted database calls without modification
3. **Snapshot System**: Expensive derived data is captured and restored instead of rebuilt

### Snapshot Lifecycle

```javascript
// 1. Automatic snapshot creation after seeding
await enableTesting()  // Seeds data + creates snapshots

// 2. Fast restoration between tests
await runMultipleTests()  // Each test restores from snapshot

// 3. Manual snapshot operations (advanced)
await testDbHelper.createBaseline()    // Create snapshot
await testDbHelper.restoreFromBaseline()  // Restore from snapshot
```

### Performance Benefits

| Operation | Without Snapshots | With Snapshots |
|-----------|-------------------|----------------|
| Test isolation | ~2-3 seconds | ~50-100ms |
| Relationship rebuild | ~1.5 seconds | ~20ms |
| Pattern ladder rebuild | ~800ms | ~15ms |
| **Total per test** | **~4-5 seconds** | **~100ms** |

## 🎪 Test Orchestration

### Multi-Test Execution

```javascript
// Run all tests with progress tracking
const results = await runMultipleTests([], {
  isolateBetweenTests: true,  // Use snapshots between tests
  showProgress: true          // Show progress indicators
});

// Results structure
{
  summary: {
    total: 5,
    successful: 5,
    failed: 0,
    totalDuration: 2100
  },
  results: [
    {
      testName: 'minimal',
      success: true,
      result: { /* test-specific results */ },
      duration: 245,
      timestamp: '2025-09-28T19:30:15.123Z'
    }
    // ... more results
  ],
  sessionId: 'session_1234567890_abc123'
}
```

### Error Handling

```javascript
// Tests with errors are captured
{
  testName: 'problematic-test',
  success: false,
  error: 'Database connection failed',
  duration: 50,
  timestamp: '2025-09-28T19:30:15.123Z'
}

// Summary includes failure analysis
❌ FAILED TESTS:
   • problematic-test: Database connection failed
```

## 🛠️ Test Development

### Adding New Tests

1. **Add to Background Script**:
```javascript
// In background.js - availableTests object
const availableTests = {
  'newTest': () => new NewTester().runTest(),
  // ... existing tests
};
```

2. **Create Test Class**:
```javascript
export class NewTester {
  async runTest(options = {}) {
    // Verify test database is active
    if (!globalThis._testDatabaseActive) {
      throw new Error('❌ Test database not active');
    }

    // Your test logic here
    const results = await yourTestLogic();

    return {
      success: true,
      testName: 'New Test',
      duration: Date.now() - startTime,
      results
    };
  }
}
```

### Test Data Access

```javascript
// Services automatically use test database when active
const sessionData = await SessionService.getOrCreateSession('standard');
const attempts = await AttemptsService.getRecentAttempts();

// Database operations are intercepted automatically
const problems = await dbHelper.getAllRecords('problems');
```

## 🚨 Troubleshooting

### Common Issues

#### Test Database Not Active
```
❌ Test database must be set up before running tests. Call enableTesting() first.
```
**Solution**: Run `await enableTesting()` before executing tests.

#### Session Already Active
```
ℹ️ Test session already active. Use { force: true } to reinitialize.
```
**Solution**: Either use existing session or force reinitialize:
```javascript
await enableTesting({ force: true })
```

#### Snapshot Not Available
```
❌ No baseline snapshot available - call createBaseline() first
```
**Solution**: Ensure `autoSnapshot: true` in enableTesting() options.

### Debug Information

```javascript
// Check system status
getTestSessionInfo()

// Check database state
console.log('DB Active:', !!globalThis._testDatabaseActive);
console.log('DB Helper:', !!globalThis._testDatabaseHelper);
console.log('Snapshot:', !!globalThis._testBaseline);

// View current configuration
console.log('Session Mode:', globalThis._testSessionMode);
```

## 📊 Best Practices

### Test Session Lifecycle

```javascript
// ✅ Recommended pattern
await enableTesting()           // Setup once
await runMultipleTests()        // Run many tests efficiently
await endTestSession()          // Clean up

// ❌ Avoid this pattern
for (const test of tests) {
  await enableTesting()         // Expensive setup
  await runTest(test)           // Single test
  await endTestSession()        // Unnecessary cleanup
}
```

### Performance Optimization

1. **Use Session Mode**: Default mode for maximum efficiency
2. **Enable Auto-Snapshots**: Default setting provides best isolation performance
3. **Batch Test Execution**: Use `runMultipleTests()` instead of individual test calls
4. **Preserve Sessions**: Don't call `endTestSession()` between test runs

### Production Safety

1. **Never Skip Test Database Check**: Tests will error if production database detected
2. **Automatic Restoration**: `endTestSession()` automatically restores production access
3. **Isolated Test Data**: All test data uses unique UIDs for forensic tracking

## 🔧 Extending the Framework

### Custom Test Categories

```javascript
// Add custom test in background.js
const availableTests = {
  'customCategory': () => runCustomTestSuite(),
  // ... existing tests
};

async function runCustomTestSuite() {
  // Your custom test logic
  return {
    success: true,
    testName: 'Custom Test Suite',
    duration: 500,
    results: { /* custom results */ }
  };
}
```

### Advanced Snapshot Management

```javascript
// Manual snapshot operations for complex scenarios
if (globalThis._testDatabaseHelper) {
  // Create custom snapshots
  const snapshot = await globalThis._testDatabaseHelper.createBaseline();

  // Run tests that modify expensive data
  await runDataModifyingTests();

  // Restore to clean state
  await globalThis._testDatabaseHelper.restoreFromBaseline();
}
```

This testing framework provides a robust foundation for maintaining CodeMaster's code quality while ensuring fast, reliable test execution across all components and services.