# Session Duplication Investigation

## Problem Statement

Sessions are being duplicated instead of being reused. The system creates new draft sessions even when existing draft sessions should be found and reused.

### Evidence from Logs

```
🔍 Atomic check: No existing session, no creation data provided
❌ No matching standard session found with status=in_progress
❌ No matching standard session found with status=draft
🆕 No existing session found, creating new standard session
```

This shows that `getOrCreateSessionAtomic()` is consistently returning `null` when it should be finding existing draft sessions.

## Root Cause Investigation

### 1. Index Configuration ✅ CORRECT

**File**: `chrome-extension-app/src/shared/db/storeCreation.js:168-169`

The composite index is properly configured:
```javascript
sessionsStore.createIndex("by_session_type_status", ["session_type", "status"], { unique: false });
```

### 2. Field Name Usage ✅ CONSISTENT

All code consistently uses `session_type` (snake_case):

**Session Creation** (`sessionService.js:884`):
```javascript
session_type: sessionType,
```

**Index Lookup** (`sessions.js:234`):
```javascript
const normalizedSessionType = sessionType || 'standard';
const existingCheck = index.get([normalizedSessionType, status]);
```

**Field Names**:
- ✅ Database stores: `session_type`, `status`
- ✅ Index expects: `["session_type", "status"]`
- ✅ Code queries: `[normalizedSessionType, status]`

### 3. Potential Root Causes

#### Theory 1: Sessions Missing `session_type` Field
**Possibility**: Some sessions in the database don't have the `session_type` field set, causing index lookups to fail.

**Evidence Needed**:
- Check actual database records for missing `session_type` fields
- Verify all sessions have proper field values

**Debug Tool**: `debug_sessions.html` created to inspect database contents

#### Theory 2: Index Not Populated
**Possibility**: The composite index exists but isn't properly populated with existing session data.

**Evidence Needed**:
- Verify index can find sessions with direct IndexedDB queries
- Check if database migration properly populated the index

#### Theory 3: Status Field Mismatch
**Possibility**: Sessions are being stored with status values that don't match what we're searching for (e.g., "DRAFT" vs "draft", or null values).

**Evidence Needed**:
- Check exact status values in database
- Verify case sensitivity and null handling

#### Theory 4: Timing/Race Condition
**Possibility**: Sessions are being queried before they're fully committed to the database and indexed.

**Evidence**: User logs show repeated "No existing session found" even though previous operations should have created sessions

## Diagnostic Steps

### Step 1: Inspect Database Contents
Open `debug_sessions.html` in the extension context to:
1. List all sessions and their field names
2. Check if `session_type` field exists on all sessions
3. Verify status values (case, spelling)
4. Test composite index lookup directly

### Step 2: Check Session Creation Flow
Verify that when sessions are created:
1. They have `session_type` field set correctly
2. They have `status` field set correctly
3. They're properly committed to IndexedDB before being queried

### Step 3: Check for Migration Issues
Verify database version 47 migration:
1. Index was created successfully
2. Existing sessions were migrated to include proper field names
3. No sessions were created before the index existed

## Code Analysis

### getOrCreateSessionAtomic (sessions.js:213-266)
**Purpose**: Atomically check for existing session or create new one

**Logic**:
1. Open transaction in 'readwrite' mode
2. Access composite index `by_session_type_status`
3. Query index with `[normalizedSessionType, status]`
4. If found: return existing session
5. If not found + newSessionData provided: create new session
6. If not found + no data: return null

**Issue**: Step 3 is returning no results when sessions should exist

### Session Lookup Flow (sessionService.js:935-973)

```javascript
// 1. Try to find in_progress session
session = await getOrCreateSessionAtomic(sessionType, 'in_progress', null);
if (session) return session;

// 2. Try to find draft session
session = await getOrCreateSessionAtomic(sessionType, 'draft', null);
if (session) return session;

// 3. No existing session found - create new one
const newSession = await this.createNewSession(sessionType, 'draft');
```

**Current Behavior**: Steps 1 and 2 always return null, causing step 3 to create duplicate sessions

## Quick Fix Options

### Option 1: Add Fallback Query (Non-Indexed)
If index lookup fails, fall back to loading all sessions and filtering manually:

```javascript
// In getOrCreateSessionAtomic
if (!existingSession) {
  // Fallback: Manual scan
  const allSessions = await store.getAll();
  existingSession = allSessions.find(s =>
    s.session_type === normalizedSessionType &&
    s.status === status
  );
}
```

**Pros**: Would work even if index is broken
**Cons**: Performance impact, doesn't fix root cause

### Option 2: Add Debug Logging
Add comprehensive logging to understand what's happening:

```javascript
console.log('🔍 Index lookup:', {
  searchKey: [normalizedSessionType, status],
  indexName: 'by_session_type_status',
  result: existingCheck.result
});

// Also log what's actually in the database
const allSessions = await store.getAll();
console.log('🔍 All sessions:', allSessions.map(s => ({
  id: s.id.substring(0, 8),
  session_type: s.session_type,
  status: s.status
})));
```

### Option 3: Verify Index Population
Add migration code to ensure all existing sessions have proper fields:

```javascript
// During database upgrade
const sessions = await sessionsStore.getAll();
sessions.forEach(session => {
  if (!session.session_type) {
    session.session_type = 'standard'; // Default value
    sessionsStore.put(session);
  }
});
```

## Next Steps

1. **Immediate**: User should open `debug_sessions.html` (in extension/app context) to see actual database contents
2. **Verify**: Check if sessions have `session_type` field properly set
3. **Test**: Try composite index lookup directly in debug tool
4. **Fix**: Based on findings, implement appropriate fix

## Related Files

- `chrome-extension-app/src/shared/db/sessions.js` - Session database operations
- `chrome-extension-app/src/shared/db/storeCreation.js` - Index configuration
- `chrome-extension-app/src/shared/services/sessionService.js` - Session lookup flow
- `debug_sessions.html` - Diagnostic tool for database inspection

## Expected Behavior After Fix

1. User generates session → Creates draft session with ID `abc123`
2. User navigates away without starting
3. User returns and clicks "Generate Session" again
4. System finds existing draft session `abc123` and returns it
5. No duplicate session created
6. Banner shows: "Session ready to start" (not "Generate new session")

## Current Broken Behavior

1. User generates session → Creates draft session with ID `abc123`
2. User navigates away without starting
3. User returns and clicks "Generate Session" again
4. System can't find draft session `abc123` (index returns null)
5. Creates NEW draft session with ID `def456`
6. Now have 2 draft sessions in database
7. Database bloat and confusion about which session is "current"
