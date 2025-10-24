# Session Cleanup and Review System Fix

## Issues Identified

### 1. No Automatic Session Cleanup
- **Problem**: Old draft/expired sessions were accumulating indefinitely
- **Evidence**: 18 total sessions with many old draft sessions never cleaned up
- **Impact**: Database bloat, unclear session history

### 2. Review System Not Working
- **Problem**: Problems due for review were not appearing in regenerated sessions
- **Evidence**: All 15 problems in the store have `review_schedule` dates in the past (Oct 15-16, 2025), but none appeared as review problems
- **Impact**: Spaced repetition system broken, users not getting proper review cycles

## Root Causes

### 1. Non-Functional Cleanup Service
**File**: `chrome-extension-app/src/shared/utils/storageCleanup.js`

The `StorageCleanupManager` was just a stub:
```javascript
// BEFORE - Non-functional stub
static cleanupOldData(_daysOld = 30) {
  return {
    deletedCount: 0,
    message: 'Cleanup stub - no actual cleanup performed'
  };
}
```

### 2. Field Name Mismatch in Review System
**File**: `chrome-extension-app/src/shared/services/scheduleService.js`

The code was checking for PascalCase field names, but the database stores snake_case:

```javascript
// BEFORE - Broken
let reviewProblems = allProblems.filter(
  (p) => isDueForReview(p.ReviewSchedule)  // ❌ undefined - database uses review_schedule
);
```

Result: `isDueForReview(undefined)` always returned `false`, so no review problems ever appeared.

## Solutions Implemented

### 1. Periodic Cleanup Service (24-Hour Interval)

**File**: `chrome-extension-app/src/shared/utils/storageCleanup.js`

Implemented automatic cleanup that runs every 24 hours:

```javascript
export default class StorageCleanupManager {
  static RETENTION_POLICY = {
    draft: 7,      // Delete draft sessions after 7 days
    expired: 30,   // Delete expired sessions after 30 days
    completed: null // NEVER delete completed sessions
  };

  static startPeriodicCleanup() {
    // Run cleanup immediately on start
    this.performAutomaticCleanup();

    // Set up 24-hour interval
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    this.cleanupIntervalId = setInterval(() => {
      this.performAutomaticCleanup();
    }, TWENTY_FOUR_HOURS);
  }

  static async performAutomaticCleanup() {
    // Delete old draft sessions (7+ days)
    // Delete old expired sessions (30+ days)
    // NEVER delete completed sessions
  }
}
```

**Key Features**:
- ✅ Runs automatically every 24 hours while extension is active
- ✅ Deletes draft sessions after 7 days
- ✅ Deletes expired sessions after 30 days
- ✅ **NEVER deletes completed sessions** - preserved forever for analytics
- ✅ Does NOT auto-expire draft sessions - lets banner system handle regeneration
- ✅ Runs immediately on extension startup + every 24 hours

### 2. Review System Fixes

#### Issue 2a: Field Name Compatibility

**File**: `chrome-extension-app/src/shared/services/scheduleService.js`

Added support for both snake_case (database) and PascalCase (legacy):

#### Issue 2b: Review Problems Should NOT Be Filtered By Tier

**Learning Science Problem**: The original code filtered review problems by current focus tier. This breaks spaced repetition!

**Why this is wrong:**
- **Spaced repetition principle**: Review what you learned, when it's due - content-agnostic
- **The problem**: If you learned "Array" problems but moved focus to "Two Pointers", Array problems due for review would be filtered out
- **Result**: You forget previously learned material! 🔴

**The Two Systems:**
1. **Review/Maintenance (Spaced Repetition)**: Should operate on ALL learned problems, no filtering
2. **New Problems (Expansion)**: Should be filtered by focus/tier for structured learning

**Fix Applied**: Completely REMOVED tier filtering from review problems. If a problem has a `review_schedule`, it means you learned it → you must review it, regardless of current focus.

```javascript
// AFTER - Fixed with NO tier filtering (correct for spaced repetition)
let reviewProblems = allProblems.filter(
  (p) => isDueForReview(p.review_schedule || p.ReviewSchedule)  // ✅ checks both field names
);

// 🔧 REMOVED tier filtering entirely
// Review problems appear based ONLY on review schedule, not current focus
// This preserves long-term retention across all learned topics

const finalReviewProblems = reviewProblems
  .sort((a, b) =>
    new Date(a.review_schedule || a.ReviewSchedule) -
    new Date(b.review_schedule || b.ReviewSchedule)  // ✅ correct sorting
  )
  .slice(0, sessionLength);
```

### 3. Background Script Integration

**File**: `chrome-extension-app/src/background/index.js`

Wired up periodic cleanup to start automatically:

```javascript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      // Start 24-hour periodic cleanup (runs immediately + every 24h)
      StorageCleanupManager.startPeriodicCleanup();
    })
  );
});
```

## Verification of Existing Systems

During investigation, verified that these systems ARE working correctly:

1. ✅ **Leitner Box Calculations**: `calculateLeitnerBox()` is called after each attempt
2. ✅ **Review Schedule Storage**: All 15 problems have valid `review_schedule` dates stored
3. ✅ **Session Completion Tracking**: `num_sessions_completed` correctly incremented to 3
4. ✅ **Onboarding Transition**: Properly exits onboarding after first session (threshold = 1)
5. ✅ **Banner System**: Handles session regeneration prompts (no auto-expire needed)

## Impact Analysis

### Before Fixes
- ❌ Old draft/expired sessions accumulating indefinitely
- ❌ 0 review problems appearing despite 15 being due
- ❌ Spaced repetition system non-functional
- ❌ Database bloat with no cleanup mechanism

### After Fixes
- ✅ Automatic cleanup every 24 hours
- ✅ Draft sessions deleted after 7 days
- ✅ Expired sessions deleted after 30 days
- ✅ **Completed sessions preserved forever** for analytics
- ✅ Review problems will appear when due
- ✅ Spaced repetition system functional
- ✅ Banner system handles session regeneration (no forced auto-expire)

## Session Lifecycle

**Draft Session → User Starts → In Progress → Completed**
- If never started: Deleted after 7 days
- If abandoned: Marked as expired by banner/user action → Deleted after 30 days
- If completed: **Preserved forever** ✅

## Testing Recommendations

1. **Test Periodic Cleanup**:
   ```javascript
   // Check console after extension loads
   // Should see: "✅ Periodic cleanup started (runs every 24 hours)"
   // And: "🧹 Starting automatic session cleanup..."

   // To manually trigger:
   StorageCleanupManager.performAutomaticCleanup().then(console.log);
   // Shows deleted count and stats
   ```

2. **Test Review System**:
   - Generate a new session
   - Verify review problems appear (all 15 problems are past their review dates)
   - Confirm session contains mix of review and new problems

3. **Verify Cleanup Policies**:
   - Create a draft session - should be deleted after 7 days
   - Mark a session as expired - should be deleted after 30 days
   - Complete a session - should NEVER be deleted
   - Wait 24+ hours - should see automatic cleanup run

## Additional Issue Fixed: Auto-Expiration of Draft Sessions

### Problem Discovered
After implementing the fixes above, discovered that **`cleanupStalledSessions()` was automatically marking draft sessions as 'expired' after only 2 hours**, causing session duplication.

**Evidence from logs:**
- User generated session at 11:09 AM → Created as `draft`
- At 11:14 AM, tried to generate again
- System couldn't find draft session (it had been auto-expired)
- Created duplicate session instead

**Root Cause:**
```javascript
// sessionService.js:1005-1007 (BEFORE FIX)
if (session.status === 'draft' && hoursStale > 2) {
  return 'draft_expired'; // Action: 'expire'
}
```

This caused:
1. `cleanupStalledSessions()` runs every 6 hours (background/index.js:10992)
2. Classifies draft sessions > 2 hours old as 'draft_expired'
3. Marks them as `status: 'expired'` (background/index.js:9888)
4. `getOrCreateSession()` looks for `['standard', 'draft']`
5. Doesn't find it (status is now 'expired')
6. Creates duplicate session

**Fix Applied:**
Removed auto-expiration of draft sessions from `_classifyGeneratorSession()` method. Draft sessions now remain as 'draft' until user explicitly triggers regeneration via banner.

## Files Modified

1. `chrome-extension-app/src/shared/services/scheduleService.js`
   - Fixed field name references for review_schedule, tags, and title
   - Added backward compatibility for both naming conventions
   - **NEW**: Changed `getDailyReviewSchedule()` to return ALL due problems by default
   - **NEW**: Added optional `maxProblems` parameter for backward compatibility
   - **NEW**: Removed artificial limiting based on review ratio

2. `chrome-extension-app/src/shared/services/problemService.js`
   - **NEW**: Implemented priority-based review selection in `addReviewProblemsToSession()`
   - **NEW**: Gets ALL due review problems, then prioritizes them for session inclusion
   - **NEW**: Review problems can now fill entire session when many are due
   - **NEW**: Review ratio becomes a target, not a hard limit

3. `chrome-extension-app/src/shared/utils/storageCleanup.js`
   - Replaced stub with full periodic cleanup implementation
   - Deletes draft sessions (7 days) and expired sessions (30 days)
   - **NEVER deletes completed sessions**
   - Runs every 24 hours automatically

4. `chrome-extension-app/src/background/index.js`
   - Added import for StorageCleanupManager
   - Integrated periodic cleanup on service worker activation
   - Starts timer on extension startup

5. `chrome-extension-app/src/shared/services/sessionService.js`
   - Removed auto-expiration of draft sessions after 2 hours
   - Draft sessions now remain as 'draft' indefinitely
   - Banner system handles prompting user for regeneration
   - Prevents `getOrCreateSession()` from creating duplicates

## Architecture Notes

- **Selective Deletion**: Only deletes old draft/expired sessions
- **Completed Sessions Preserved**: All completed sessions kept forever for analytics
- **No Auto-Expire**: Draft sessions stay as "draft" until banner prompts user action
- **Periodic Execution**: Runs every 24 hours while extension is active
- **Immediate Start**: First cleanup runs on extension startup
- **No Breaking Changes**: All fixes maintain backward compatibility
- **Field Name Transition**: Supports both snake_case and PascalCase
- **No Corruption Risk**: Atomic IndexedDB transactions ensure data integrity

## Additional Issue Fixed: Review Problem Artificial Limiting

### Problem Discovered
After implementing the field name compatibility and tier filtering fixes, discovered that **review problems were being artificially limited by the review ratio**, even when more problems were due for review.

**Evidence from logs:**
- Log: `🔍 DEBUG: Problems due for review (no tier filtering): 15`
- Log: `✅ Final Review Set: (2) [{…}, {…}]`
- **Issue**: 15 problems were correctly detected as due, but only 2 were being returned to the session

**Root Cause:**
```javascript
// scheduleService.js - BEFORE FIX
const reviewTarget = Math.floor(sessionLength * reviewRatio); // 5 * 0.4 = 2
const reviewProblems = await ScheduleService.getDailyReviewSchedule(reviewTarget);

// Inside getDailyReviewSchedule():
const finalReviewProblems = reviewProblems
  .sort(...)
  .slice(0, sessionLength); // Limited to reviewTarget (2)
```

**Why this is wrong:**
- **Spaced repetition principle**: If problems are DUE for review, they should ALL appear, not be limited by an arbitrary ratio
- **The problem**: For a 5-problem session with 40% review ratio, only 2 review problems would appear even if 15 were overdue
- **Result**: User falls behind on reviews, defeating the purpose of spaced repetition! 🔴

**Fix Applied: Priority-Based Review Selection**

1. **scheduleService.js** - Return ALL due problems:
```javascript
// AFTER FIX
export async function getDailyReviewSchedule(maxProblems = null) {
  // ... find all due problems ...

  // Sort by review date (most overdue first)
  const sortedReviewProblems = reviewProblems.sort(...);

  // Only limit if maxProblems explicitly provided (backward compatibility)
  const finalReviewProblems = maxProblems !== null
    ? sortedReviewProblems.slice(0, maxProblems)
    : sortedReviewProblems; // Return ALL due problems

  return finalReviewProblems;
}
```

2. **problemService.js** - Priority-based selection:
```javascript
// AFTER FIX
async function addReviewProblemsToSession(...) {
  // Get ALL problems due for review (no artificial limit)
  const allReviewProblems = await ScheduleService.getDailyReviewSchedule(null);

  const validReviewProblems = (allReviewProblems || []).filter(p => p && (p.id || p.leetcode_id));

  // Priority logic: Take up to sessionLength worth of review problems
  // This allows reviews to dominate the session when many are due
  const reviewProblemsToAdd = validReviewProblems.slice(0, Math.min(sessionLength, validReviewProblems.length));

  if (reviewProblemsToAdd.length > reviewTarget) {
    logger.info(`ℹ️ Review problems (${reviewProblemsToAdd.length}) exceeded target ratio - prioritizing spaced repetition over new content`);
  }

  return reviewProblemsToAdd.length;
}
```

**New Behavior:**
- ✅ Get ALL problems due for review (no arbitrary limiting)
- ✅ Prioritize reviews over new content when many are due
- ✅ Can fill entire session with reviews if needed (proper spaced repetition)
- ✅ New problems only added if space remains after reviews
- ✅ Review ratio becomes a *target*, not a hard limit

**Example Scenarios:**
1. **Few reviews due** (2 out of 15 due):
   - Session size: 5
   - Review ratio: 40% (target = 2)
   - Result: 2 review + 3 new problems ✅

2. **Many reviews due** (15 out of 15 due):
   - Session size: 5
   - Review ratio: 40% (target = 2)
   - Old behavior: 2 review + 3 new (13 reviews ignored!) ❌
   - New behavior: 5 review + 0 new (prioritizes spaced repetition) ✅

3. **All reviews caught up** (0 due):
   - Session size: 5
   - Review ratio: 40% (target = 2)
   - Result: 0 review + 5 new problems ✅

## Future Considerations

1. **Configurable Retention**: Add settings UI to customize retention periods (7/30 days)
2. **Field Name Migration**: Eventually migrate all PascalCase fields to snake_case
3. **Cleanup Analytics**: Track cleanup statistics for monitoring database health
4. **Status Dashboard**: Show session breakdown (active/expired/completed) in analytics
5. **Manual Cleanup Button**: Add UI control for on-demand cleanup
6. **Review Priority Settings**: Allow users to configure whether reviews should dominate sessions or respect ratio strictly
