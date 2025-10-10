# Background Script Refactoring Strategy

## Overview
Refactor `src/background/index.js` (13,010 lines, 189 linting errors) into maintainable, testable modules while preserving all functionality.

## Current State Analysis

### File Statistics
- **Total Lines**: 13,010
- **Linting Errors**: 189 (≈50% of project total)
- **Message Handlers**: 113+ unique message types
- **Message Listeners**: 2 (lines 111 and 10025)

### Structure Breakdown
1. **Imports and Dependencies** (lines 1-110)
   - Service imports (ProblemService, SessionService, etc.)
   - Database imports
   - Utility imports

2. **First Message Listener** (line 111)
   - Simple PING handler
   - Minimal functionality

3. **Global Exports** (scattered throughout)
   - SessionTester, TestScenarios
   - Service classes (ProblemService, SessionService, etc.)
   - Utility classes (AccurateTimer, ChromeAPIErrorHandler)

4. **Second Message Listener** (line 10025)
   - Main message router with massive switch statement
   - Handles all application messaging

### Message Handler Categories
1. **Dashboard Data** (getGoalsData, getStatsData, getDashboardStatistics)
2. **Database Operations** (getAllProblems, addProblem, getRecord, updateRecord)
3. **Session Management** (getOrCreateSession, completeSession, updateSessionSettings)
4. **Onboarding** (checkOnboardingStatus, completeOnboarding)
5. **Test/Health Endpoints** (backgroundScriptHealth, HEALTH_CHECK, testAsync)
6. **Consistency Checks** (checkConsistencyAlerts, consistency-check alarm)
7. **Interview Mode** (getInterviewAnalytics, completeInterviewSession)
8. **Learning Progress** (getLearningProgressData, getInterviewProgressData)

## Testing Coverage Assessment

### Existing Tests
- **backgroundScript.integration.test.js**: Only tests getGoalsData handler
- **Coverage**: <1% of message handlers tested
- **Conclusion**: Insufficient for safe refactoring

### Required Test Coverage
Before refactoring, we need comprehensive tests for:
1. All 113+ message handlers
2. Error handling paths
3. Service interaction patterns
4. Global exports functionality

## Refactoring Strategy

### Phase 1: Establish Test Baseline (CURRENT PHASE)
**Goal**: Create comprehensive tests before any refactoring

**Actions**:
1. Create `src/background/__tests__/messageHandlers.test.js`
   - Test all message types by category
   - Mock service dependencies
   - Verify response structures
   - Test error handling

2. Create `src/background/__tests__/globalExports.test.js`
   - Verify all globalThis exports are accessible
   - Test that services are properly initialized

3. Run full test suite to establish baseline
   - Target: 100% handler coverage
   - Document expected behaviors

### Phase 2: Extract Message Handler Router
**Goal**: Move message routing logic to separate module

**Actions**:
1. Create `src/background/messageRouter.js`
   - Extract all message handler functions
   - Maintain identical function signatures
   - Keep all error handling

2. Update `src/background/index.js`
   - Import message router
   - Delegate to router in message listener
   - Keep service worker lifecycle code

3. Run tests after extraction
   - Verify all handlers still work
   - Check no functionality lost

**Expected Reduction**: ~10,000 lines moved, ~150 linting errors addressed

### Phase 3: Extract Test/Health Check System
**Goal**: Separate test infrastructure from production code

**Actions**:
1. Create `src/background/testingSystem.js`
   - Move SessionTester, TestScenarios
   - Move all test-related handlers
   - Move health check functions

2. Update imports and references
3. Run tests after extraction

**Expected Reduction**: ~1,000 lines moved, ~10 linting errors addressed

### Phase 4: Extract Consistency Check System
**Goal**: Isolate consistency checking logic

**Actions**:
1. Create `src/background/consistencyChecker.js`
   - Move alarm setup and handlers
   - Move consistency check logic
   - Move alerting integration

2. Update imports and references
3. Run tests after extraction

**Expected Reduction**: ~500 lines moved, ~5 linting errors addressed

### Phase 5: Organize Message Handlers by Category
**Goal**: Further break down messageRouter.js into domain-specific modules

**Actions**:
1. Create handler modules:
   - `src/background/handlers/dashboardHandlers.js`
   - `src/background/handlers/databaseHandlers.js`
   - `src/background/handlers/sessionHandlers.js`
   - `src/background/handlers/onboardingHandlers.js`
   - `src/background/handlers/interviewHandlers.js`

2. Update messageRouter to import and delegate
3. Run tests after each module extraction

**Expected Reduction**: messageRouter.js reduced to ~500 lines (routing logic only)

### Phase 6: Final Cleanup and Optimization
**Goal**: Address remaining linting errors and optimize structure

**Actions**:
1. Fix remaining linting errors in each module
2. Add JSDoc documentation to exported functions
3. Optimize imports and dependencies
4. Run final lint check

**Expected Reduction**: All remaining linting errors addressed

## Safety Measures

### Before Each Extraction
1. ✅ Run full test suite
2. ✅ Document current passing test count
3. ✅ Commit changes to git

### After Each Extraction
1. ✅ Run full test suite
2. ✅ Verify same test count passing
3. ✅ Run lint to verify error reduction
4. ✅ Manual smoke test of key features
5. ✅ Commit changes to git

### Rollback Plan
If any extraction causes test failures:
1. Revert the commit immediately
2. Analyze the failure root cause
3. Adjust extraction approach
4. Re-attempt with smaller scope

## Success Criteria

### Phase 1 Complete When:
- [ ] All 113+ message handlers have tests
- [ ] Test suite passes with 100% handler coverage
- [ ] Baseline documented

### Phase 2 Complete When:
- [ ] messageRouter.js extracted
- [ ] All tests still pass
- [ ] index.js reduced to <3,000 lines
- [ ] Lint errors reduced by ~80%

### Final Success When:
- [ ] index.js is <1,500 lines
- [ ] Zero linting errors in background/ directory
- [ ] All tests passing
- [ ] No functionality lost (verified by tests)
- [ ] Code is maintainable and well-documented

## Risk Assessment

### High Risk Areas
1. **Chrome API Context**: Service worker context has strict limitations
2. **Global Exports**: External code may depend on globalThis exports
3. **Message Handler Timing**: Async message handling must preserve response timing
4. **Import Cycles**: Extracting modules may create circular dependencies

### Mitigation Strategies
1. Keep all Chrome API calls in same execution context
2. Maintain all globalThis exports in index.js, import from new modules
3. Preserve exact async/await patterns in extracted handlers
4. Carefully design module boundaries to avoid cycles

## Timeline Estimate

- **Phase 1**: 2-3 hours (test creation)
- **Phase 2**: 1-2 hours (main extraction)
- **Phase 3**: 30 minutes (test system)
- **Phase 4**: 30 minutes (consistency checks)
- **Phase 5**: 1-2 hours (categorization)
- **Phase 6**: 1 hour (cleanup)

**Total**: 6-9 hours of focused work

## Next Immediate Steps

1. ✅ Create this strategy document (COMPLETE)
2. ⏳ Create comprehensive message handler tests
3. ⏳ Run baseline test suite
4. ⏳ Begin Phase 2 extraction
