# Capability Baseline Summary

## Overview
This document provides a quick reference for the comprehensive capability baseline analysis of the `routeMessage` function.

**Full Documentation**: `capability-baseline-messageRouter.md`

---

## Key Metrics

- **Total Message Types**: 64 distinct handlers
- **Function Length**: 1251 lines
- **Complexity Score**: 107 (5x over limit)
- **Async Handlers**: 52 return `true` for async channel
- **Error Handlers**: 58 try-catch blocks
- **Cache Operations**: 4 cache-clearing operations + 1 cache-read operation

---

## Functional Domains (16 categories)

1. **Backup & Database** (2 handlers)
   - backupIndexedDB, getBackupFile

2. **Storage Management** (4 handlers)
   - setStorage, getStorage, removeStorage, getSessionState

3. **User Onboarding** (10 handlers)
   - Installation, content, page tour onboarding flows

4. **User Settings** (3 handlers)
   - setSettings, getSettings, clearSettingsCache
   - **Critical**: setSettings writes to chrome.storage.local for theme sync

5. **Session Cache** (1 handler)
   - clearSessionCache

6. **Problems Management** (7 handlers)
   - CRUD operations, counting, attempt stats
   - **Critical**: addProblem clears 6 dashboard cache keys
   - **Critical**: problemSubmitted broadcasts to all tabs

7. **Sessions Management** (12 handlers)
   - Session lifecycle, interview sessions, cleanup, analytics
   - **Critical**: getOrCreateSession has interview banner logic
   - **Critical**: Timeout monitoring (25-30 seconds)

8. **Interview Analytics** (1 handler)
   - getInterviewAnalytics

9. **Adaptive Limits & Navigation** (2 handlers)
   - getLimits, navigate

10. **Dashboard Data** (16 handlers)
    - Statistics, progress, goals, mastery, focus areas, learning paths
    - **Critical**: getGoalsData uses FocusCoordinationService
    - **Critical**: getFocusAreasData has fallback default tags

11. **Hint Interactions** (4 handlers)
    - Save, retrieve by problem/session, stats
    - **Critical**: saveHintInteraction enriches with problem context

12. **Background Health & Testing** (4 handlers)
    - Health checks, test function availability

13. **Strategy Data** (4 handlers)
    - Strategy map, tag strategies (single/bulk), data loaded check
    - **Critical**: getStrategyForTag uses caching

14. **Database Proxy** (1 handler)
    - Generic DATABASE_OPERATION with 5 operations

15. **Session Consistency & Habits** (4 handlers)
    - Patterns, alerts, streak risk, re-engagement timing

16. **Default Case** (1 handler)
    - Returns error for unknown types

---

## Critical Behavioral Risks During Refactoring

### HIGH RISK - Must Preserve

1. **Cache Invalidation in addProblem** (Lines 386-397)
   - Clears 6 dashboard cache keys
   - MUST happen after problem add, regardless of success field
   - Loss would cause stale dashboard data

2. **Cross-Tab Broadcast in problemSubmitted** (Lines 412-426)
   - Uses chrome.tabs.query() + chrome.tabs.sendMessage()
   - Notifies all content scripts about submission
   - Loss would break multi-tab navigation state

3. **Chrome Storage Sync in setSettings** (Lines 267-274)
   - Writes to chrome.storage.local for theme sync
   - Enables cross-context theme updates
   - Loss would break theme synchronization

4. **Interview Banner Logic in getOrCreateSession** (Lines 477-492)
   - Returns null for manual interview mode to trigger banner
   - Complex conditional logic checking settings
   - Loss would auto-create sessions instead of showing banner

5. **Problem Enrichment in saveHintInteraction** (Lines 1328-1338)
   - Fetches problem to add boxLevel and problemDifficulty
   - Enrichment happens in background to avoid IndexedDB in content script
   - Loss would save incomplete interaction data

6. **Focus Coordination in getGoalsData** (Lines 1156-1176)
   - Uses FocusCoordinationService.getFocusDecision()
   - Passes complex context with focus areas and recommendations
   - Loss would show incorrect focus areas in dashboard

### MEDIUM RISK - Verify Carefully

7. **Timeout Monitoring** (Lines 498-501, 555-558)
   - 25-30 second timeouts for session operations
   - Cleanup in finally blocks
   - Loss would cause hanging operations

8. **Staleness Detection in getOrCreateSession** (Lines 513-524)
   - Classifies session state as active/unclear/stale
   - Returns isSessionStale flag
   - Loss would display stale sessions as active

9. **Fallback Focus Areas** (Lines 1249-1252)
   - Provides default 5 tags if none configured
   - Ensures UI always has focus areas
   - Loss would cause empty focus area displays

10. **ID Type Conversion in getSimilarProblems** (Line 1439)
    - Converts to Number for Map key lookup
    - Critical for relationship matching
    - Loss would fail to find similar problems

### LOW RISK - Should Be Preserved

11. **Error Response Formats**
    - Some handlers return `{ error }`, others `{ status: "error", error }`
    - UI may depend on specific format
    - Change would require UI updates

12. **Console Logging**
    - Extensive logging throughout (100+ log statements)
    - Used for debugging and monitoring
    - Removal would reduce observability

13. **finishRequest() Calls**
    - Called in finally blocks for async handlers
    - Required for request tracking
    - Loss would leak request tracking

---

## Recommended Refactoring Strategy

### Phase 1: Extract by Domain (SAFE)
- Create 16 handler files (one per domain)
- Move handlers without modification
- Preserve all logic exactly

### Phase 2: Create Router Registry (SAFE)
- Build map of message type → handler function
- Replace switch statement with map lookup
- Keep same handler signatures

### Phase 3: Standardize Error Handling (MEDIUM RISK)
- Create handler wrapper for try-catch-finally
- Test thoroughly - error formats may differ
- Keep fallback responses for critical handlers

### Phase 4: Add Integration Tests (SAFE)
- Test each message type end-to-end
- Verify responses match original format
- Check all side effects occur

### Phase 5: Use Capability Guard Linter (SAFE)
- Run linter comparing original vs refactored
- Address all HIGH and MEDIUM risk findings
- Document any intentional changes

---

## Testing Recommendations

### Unit Tests (Per Handler)
```javascript
describe('addProblem handler', () => {
  it('should clear dashboard cache after adding problem', () => {
    // Verify cache.delete() called for all 6 keys
  });

  it('should clear cache even if success field is missing', () => {
    // Verify cache clearing is unconditional
  });
});
```

### Integration Tests (Message Flow)
```javascript
describe('message routing', () => {
  it('should broadcast problemSubmitted to all tabs', async () => {
    // Mock chrome.tabs.query and chrome.tabs.sendMessage
    // Verify all http/https tabs receive message
  });

  it('should enrich hint interactions with problem context', async () => {
    // Mock getProblem() and HintInteractionService
    // Verify enrichment fields are added
  });
});
```

### Capability Guard Linter Tests
```javascript
describe('capability guard linter', () => {
  it('should detect missing cache invalidation', () => {
    // Compare original addProblem vs version without cache clearing
    // Expect HIGH risk finding
  });

  it('should detect missing cross-tab broadcast', () => {
    // Compare original problemSubmitted vs version without broadcast
    // Expect HIGH risk finding
  });
});
```

---

## Usage Instructions

### Before Refactoring
1. Read full baseline document: `capability-baseline-messageRouter.md`
2. Identify handlers you plan to modify
3. Note all HIGH and MEDIUM risk behaviors in those handlers
4. Create tests for those specific behaviors

### During Refactoring
1. Extract handlers one domain at a time
2. Run tests after each extraction
3. Verify all side effects still occur
4. Check error response formats match

### After Refactoring
1. Run capability-guard-linter comparing original vs refactored
2. Address all HIGH risk findings immediately
3. Investigate all MEDIUM risk findings
4. Document any intentional behavior changes
5. Update UI if response formats changed

### Validation Checklist
- [ ] All 64 message types still handled
- [ ] Cache invalidation in addProblem works
- [ ] Cross-tab broadcast in problemSubmitted works
- [ ] Theme sync in setSettings works
- [ ] Interview banner logic preserved
- [ ] Problem enrichment in hints works
- [ ] Focus coordination in goals works
- [ ] Timeout monitoring works
- [ ] Staleness detection works
- [ ] All async handlers return true
- [ ] All finishRequest() calls preserved
- [ ] Error formats match or UI updated

---

## Key Files to Review Before Refactoring

1. `src/background/messageRouter.js` - The subject of this analysis
2. `src/background/index.js` - Background script that calls routeMessage
3. `src/shared/services/` - All service dependencies
4. `src/app/services/dashboardService.js` - Dashboard data aggregation
5. `src/shared/db/` - Database operations
6. Content scripts that send messages to background

---

## Contact / Questions

When using the capability-guard-linter after refactoring:
- Provide SOURCE_COMMIT hash pointing to current code
- Run linter against HEAD after refactoring
- Prioritize HIGH risk findings
- Investigate MEDIUM risk findings
- Document rationale for any accepted risks

---

**Generated**: 2025-10-11
**For**: messageRouter.js refactoring (complexity 107 → target <20)
**Purpose**: Prevent capability loss during refactoring
