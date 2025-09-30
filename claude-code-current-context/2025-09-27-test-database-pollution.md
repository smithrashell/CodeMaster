# Test Database Pollution Issue - 2025-09-27

## Current Problem
Tests are running during Chrome extension initialization and writing to the **main CodeMaster database** instead of test databases.

## What We've Tried (That Didn't Work)
1. ❌ **Global database context switching** - Created circular import dependencies
2. ❌ **Modified TestDataIsolation.enterTestMode()** - Still creates multiple test databases
3. ❌ **Moved testCoreBusinessLogic function** - Function now loads but tests pollute main DB

## Current Status
- ✅ `testCoreBusinessLogic()` function is now accessible
- ❌ Tests run automatically during extension load (not when we call the function)
- ❌ Tests write to main CodeMaster database during extension initialization
- ❌ Multiple test databases still being created when tests do run

## Root Cause Analysis
Tests are being executed during **import/initialization** phase, not during manual function calls. This happens because:
- Some imported classes may have side effects that trigger database operations
- Test functions are being called somewhere during extension startup
- No test database context is active during extension load

## Symptoms
- Session records appearing in main database during extension reload
- Test data polluting production user data
- Multiple CodeMaster_test_* databases being created

## What Needs Investigation
1. Find where tests are being auto-executed during extension load
2. Identify which imports are causing database operations
3. Ensure tests only run when explicitly called, not during initialization

## Success Criteria
- Extension loads without running any tests
- Tests only execute when `testCoreBusinessLogic()` is manually called
- All test operations write to test databases, not main CodeMaster database
- Single test database per test run (no multiple test databases)