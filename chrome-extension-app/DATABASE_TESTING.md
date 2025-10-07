# Database Testing Safety Guide

## 🚨 CRITICAL: Production Database Protection

This codebase has **multiple layers of protection** to prevent test code from corrupting production data:

### Runtime Protection
- **Automatic Detection**: Tests are automatically detected via stack traces, global functions, and environment
- **Database Blocking**: Production database access throws an error when called from test context
- **Error Message**: `🚨 SAFETY VIOLATION: Test code attempted to access production database 'CodeMaster'. Use createTestDbHelper() instead of the production dbHelper.`

### ESLint Protection
- **Import Restrictions**: Test files cannot import production `dbHelper`
- **Syntax Checking**: Test files are scanned for prohibited database operations
- **Build Failure**: Violations cause linting errors that break the build

## ✅ Correct Test Database Usage

### Use Test Database Helper
```javascript
// ❌ WRONG - Uses production database
import { dbHelper } from '../shared/db/index.js';

// ✅ CORRECT - Uses isolated test database
import { createTestDbHelper } from '../shared/db/dbHelperFactory.js';

const testDb = createTestDbHelper();
await testDb.put('problems', { id: 1, title: 'Test Problem' });
```

### Test Database Features
- **Isolation**: Each test gets unique database: `CodeMaster_test_${sessionId}`
- **Safety**: Cannot delete production database (safety check prevents this)
- **Cleanup**: Test databases can be safely deleted after tests
- **Seeding**: Built-in scenario seeding for consistent test data

### Test Scenarios
```javascript
// Basic test data setup
const testDb = createScenarioTestDb('basic');
await testDb.seedScenario('basic'); // Adds sample problems and settings

// Empty database for custom setup
const testDb = createScenarioTestDb('empty');

// Complex scenario for advanced testing
const testDb = createScenarioTestDb('experienced');
await testDb.seedScenario('experienced'); // Full dataset
```

## 🔧 Current Issue Resolution

**Problem**: Browser-based tests (like `testRealLearningFlow`) bypass the service layer and directly access production database

**Solution**: The runtime safety checks now block this access and throw clear error messages

**Next Steps**:
1. Update test code to use `createTestDbHelper()` instead of services that use production database
2. Tests should be isolated and use mock/test data, not real production services
3. Consider making browser tests read-only or using completely separate test environment

## 🎯 Best Practices

1. **Always use test database helpers** in test files
2. **Never import production dbHelper** in test code
3. **Clean up test databases** after test completion
4. **Use scenario seeding** for consistent test data
5. **Run ESLint** to catch safety violations before commit

The multi-layer protection ensures that accidental production database access is caught at:
- ✅ Development time (ESLint warnings)
- ✅ Runtime (Error thrown with clear message)
- ✅ Build time (ESLint errors break build)