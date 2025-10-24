# Capability Baseline: routeMessage Function

**Date Created**: 2025-10-11
**Source File**: `chrome-extension-app/src/background/messageRouter.js`
**Function**: `routeMessage`
**Current Complexity**: 107 (5x over limit of 20)
**Current Length**: 1251 lines
**Purpose**: Central message routing hub for all Chrome extension background messages

---

## Executive Summary

This document serves as a **capability baseline** for the `routeMessage` function before refactoring. The function handles **64 distinct message types** across 11 functional domains. Any refactoring MUST preserve all behavioral capabilities documented here.

**Critical Risk Areas**:
- Asynchronous response handling (52 async handlers)
- Cache invalidation logic (4 cache-clearing operations)
- Error handling patterns (58 try-catch blocks)
- Side effects (Chrome storage writes, tab messaging, IndexedDB operations)
- Return value conventions (42 handlers return `true` for async channels)

---

## Complete Message Type Catalog

### 1. Backup & Database Operations (2 handlers)

#### `backupIndexedDB`
- **Location**: Lines 95-106
- **Behavior**: Initiates full IndexedDB backup
- **Side Effects**:
  - Calls `backupIndexedDB()` function
  - Console logging (📌, ✅, ❌)
- **Response**: `{ message: "Backup successful" }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Error Handling**: Catch block sends error response

#### `getBackupFile`
- **Location**: Lines 108-119
- **Behavior**: Retrieves existing backup file
- **Side Effects**:
  - Calls `getBackupFile()` function
  - Console logging (📌, ✅, ❌)
- **Response**: `{ backup }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Error Handling**: Catch block sends error response

---

### 2. Storage Management (4 handlers)

#### `setStorage`
- **Location**: Lines 122-126
- **Behavior**: Sets storage key-value pair
- **Dependencies**: `StorageService.set()`
- **Side Effects**: IndexedDB write via StorageService
- **Response**: Result from StorageService
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getStorage`
- **Location**: Lines 127-131
- **Behavior**: Retrieves storage value by key
- **Dependencies**: `StorageService.get()`
- **Response**: Stored value
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `removeStorage`
- **Location**: Lines 132-136
- **Behavior**: Removes storage key
- **Dependencies**: `StorageService.remove()`
- **Side Effects**: IndexedDB deletion via StorageService
- **Response**: Result from StorageService
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getSessionState`
- **Location**: Lines 327-331
- **Behavior**: Retrieves session state from storage
- **Dependencies**: `StorageService.getSessionState("session_state")`
- **Response**: Session state object
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 3. User Onboarding (10 handlers)

#### `onboardingUserIfNeeded`
- **Location**: Lines 138-159
- **Behavior**: Checks and performs user onboarding if needed
- **Dependencies**: `onboardUserIfNeeded()`
- **Response Format Handling**: Supports both old and new response formats
  - New format: `{ success: true, message: "..." }`
  - Old format: Legacy success assumption
- **Error Handling**:
  - Returns graceful error with `fallback: true` flag
  - Does not break UI on failure
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `checkInstallationOnboardingStatus`
- **Location**: Lines 161-180
- **Behavior**: Checks installation onboarding completion status
- **Dependencies**: `StorageService.get('installation_onboarding_complete')`
- **Side Effects**: Console logging (🔍, ❌)
- **Response**: `{ isComplete, timestamp, version, error }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `checkContentOnboardingStatus`
- **Location**: Lines 182-190
- **Behavior**: Checks content onboarding status
- **Dependencies**: `checkContentOnboardingStatus()`
- **Response**: Status object or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `checkOnboardingStatus`
- **Location**: Lines 192-200
- **Behavior**: General onboarding status check
- **Dependencies**: `checkOnboardingStatus()` (from dependencies object)
- **Response**: Status object or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `completeOnboarding`
- **Location**: Lines 202-210
- **Behavior**: Marks onboarding as complete
- **Dependencies**: `completeOnboarding()` (from dependencies object)
- **Side Effects**: Updates onboarding state in storage
- **Response**: Completion result or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `updateContentOnboardingStep`
- **Location**: Lines 212-220
- **Behavior**: Updates current content onboarding step
- **Parameters**: `request.step`
- **Dependencies**: `updateContentOnboardingStep(step)`
- **Side Effects**: Updates step state in storage
- **Response**: Update result or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `completeContentOnboarding`
- **Location**: Lines 222-230
- **Behavior**: Completes content onboarding flow
- **Dependencies**: `completeContentOnboarding()`
- **Side Effects**: Updates completion state in storage
- **Response**: Completion result or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `checkPageTourStatus`
- **Location**: Lines 232-240
- **Behavior**: Checks if page tour completed for specific page
- **Parameters**: `request.pageId`
- **Dependencies**: `checkPageTourStatus(pageId)`
- **Response**: Tour status or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `markPageTourCompleted`
- **Location**: Lines 242-250
- **Behavior**: Marks page tour as completed
- **Parameters**: `request.pageId`
- **Dependencies**: `markPageTourCompleted(pageId)`
- **Side Effects**: Updates tour completion in storage
- **Response**: Update result or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `resetPageTour`
- **Location**: Lines 252-260
- **Behavior**: Resets page tour to allow re-showing
- **Parameters**: `request.pageId`
- **Dependencies**: `resetPageTour(pageId)`
- **Side Effects**: Clears tour completion state
- **Response**: Reset result or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 4. User Settings (3 handlers)

#### `setSettings`
- **Location**: Lines 262-283
- **Behavior**: Saves user settings with Chrome storage sync
- **Parameters**: `request.message` (settings object)
- **Dependencies**: `StorageService.setSettings()`
- **Side Effects**:
  - IndexedDB write via StorageService
  - **CRITICAL**: Also writes to `chrome.storage.local` for cross-context sync
  - Enables theme synchronization across extension contexts
- **Chrome Storage Write**: Lines 267-274 - writes to chrome.storage.local with error handling
- **Response**: `{ status: "success/error", message }` or error response
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block
- **Error Handling**: Catches and logs Chrome storage errors without failing request

#### `getSettings`
- **Location**: Lines 284-286
- **Behavior**: Retrieves user settings
- **Dependencies**: `StorageService.getSettings()`
- **Response**: Settings object
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `clearSettingsCache`
- **Location**: Lines 287-307
- **Behavior**: Clears all settings-related cache entries
- **Dependencies**: `responseCache` Map from dependencies
- **Side Effects**:
  - Deletes cache entries matching 'settings_all' or 'settings_' prefix
  - Console logging for each deleted key (🗑️)
  - Calls `StorageService.clearSettingsCache()` for internal cleanup
- **Cache Keys**: `['settings_all', 'settings_']`
- **Response**: `{ status: "success", clearedCount }`
- **Async**: NO - returns `true` immediately after sync operation
- **Cleanup**: Calls `finishRequest()` before return

---

### 5. Session Cache Management (1 handler)

#### `clearSessionCache`
- **Location**: Lines 308-325
- **Behavior**: Clears session-related cache entries
- **Dependencies**: `responseCache` Map from dependencies
- **Side Effects**:
  - Deletes cache entries matching session prefixes
  - Console logging for each deleted key (🗑️, 🔄)
- **Cache Keys**: `['createSession', 'getActiveSession', 'session_']`
- **Response**: `{ status: "success", clearedCount }`
- **Async**: NO - returns `true` immediately after sync operation
- **Cleanup**: Calls `finishRequest()` before return

---

### 6. Problems Management (7 handlers)

#### `getProblemByDescription`
- **Location**: Lines 334-350
- **Behavior**: Finds problem by description or slug
- **Parameters**: `request.description`, `request.slug`
- **Dependencies**: `ProblemService.getProblemByDescription()`
- **Side Effects**: Console logging (🧼, ❌)
- **Response**: Problem object or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `countProblemsByBoxLevel`
- **Location**: Lines 351-368
- **Behavior**: Counts problems grouped by Leitner box level
- **Parameters**: `request.forceRefresh` (optional)
- **Dependencies**:
  - `ProblemService.countProblemsByBoxLevel()` (cached)
  - `ProblemService.countProblemsByBoxLevelWithRetry({ priority: "high" })` (fresh)
- **Conditional Logic**: Uses refresh logic if `forceRefresh` is true
- **Side Effects**: Console logging (📊, ❌)
- **Response**: `{ status: "success", data: counts }` or `{ status: "error", message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `addProblem`
- **Location**: Lines 370-407
- **Behavior**: Adds or updates problem with attempt tracking
- **Parameters**: `request.contentScriptData`
- **Dependencies**: `ProblemService.addOrUpdateProblemWithRetry()`
- **Side Effects**:
  - **CRITICAL CACHE INVALIDATION**: Clears dashboard cache keys (lines 386-397)
  - Console logging with detailed debugging (📊, 🔄, 🗑️, 💨, ❌)
- **Dashboard Cache Keys Cleared**: `['stats_data', 'progress_data', 'sessions_data', 'mastery_data', 'productivity_data', 'learning_path_data']`
- **Response**: Result from ProblemService or `{ error: "Failed to add problem: ..." }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block
- **Error Handling**: Catches errors with timestamp logging

#### `problemSubmitted`
- **Location**: Lines 409-429
- **Behavior**: Broadcasts problem submission to all content scripts
- **Side Effects**:
  - **CRITICAL CROSS-TAB MESSAGING**: Queries all tabs and sends `{ type: "problemSubmitted" }` message
  - Only targets http/https URLs
  - Console logging for each tab notification (🔄, ℹ️, ✅)
- **Chrome API Calls**:
  - `chrome.tabs.query({})`
  - `chrome.tabs.sendMessage(tab.id, { type: "problemSubmitted" })`
- **Error Handling**: Ignores errors from tabs without content scripts
- **Response**: `{ status: "success", message: "Problem submission notification sent" }`
- **Async**: NO - returns `true` immediately after initiating broadcast
- **Cleanup**: Calls `finishRequest()` before return

#### `skipProblem`
- **Location**: Lines 431-436
- **Behavior**: Acknowledges problem skip request
- **Parameters**: `request.consentScriptData?.leetcode_id` (for logging only)
- **Side Effects**: Console logging (⏭️)
- **Response**: `{ message: "Problem skipped successfully" }`
- **Async**: NO - returns `true` immediately
- **Cleanup**: Calls `finishRequest()` before return
- **Note**: No database operations - pure acknowledgment

#### `getAllProblems`
- **Location**: Lines 438-443
- **Behavior**: Retrieves all problems from database
- **Dependencies**: `ProblemService.getAllProblems()`
- **Response**: Problems array or `{ error: "Failed to retrieve problems" }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getProblemById`
- **Location**: Lines 445-453
- **Behavior**: Retrieves specific problem with official difficulty
- **Parameters**: `request.problemId`
- **Dependencies**: `getProblemWithOfficialDifficulty(problemId)`
- **Response**: `{ success: true, data: problemData }` or `{ success: false, error }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getProblemAttemptStats`
- **Location**: Lines 455-463
- **Behavior**: Gets attempt statistics for specific problem
- **Parameters**: `request.problemId`
- **Dependencies**: `AttemptsService.getProblemAttemptStats(problemId)`
- **Response**: `{ success: true, data: stats }` or `{ success: false, error }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 7. Sessions Management (12 handlers)

#### `getSession`
- **Location**: Lines 466-471
- **Behavior**: Retrieves current session
- **Dependencies**: `SessionService.getSession()`
- **Response**: `{ session }` or `{ error: "Failed to get session" }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getOrCreateSession`
- **Location**: Lines 473-549
- **Behavior**: Gets existing session or creates new one with interview mode logic
- **Parameters**: `request.sessionType` (optional)
- **Dependencies**:
  - `StorageService.getSettings()`
  - `SessionService.getOrCreateSession(sessionType)`
  - `SessionService.classifySessionState(session)`
  - `withTimeout()` wrapper from dependencies
- **Complex Logic**:
  - **Interview Banner Logic** (lines 477-492): Returns null if manual interview mode to trigger banner
  - **Default Session Type** (line 495): Defaults to 'standard' to prevent auto-interview triggering
  - **Timeout Monitoring** (lines 498-501): 30-second timeout with logging
  - **Staleness Detection** (lines 513-524): Classifies session state and checks if stale
- **Side Effects**:
  - Console logging with timing metrics
  - Timeout scheduling and cleanup
- **Response**:
  - Interview mode manual: `{ session: null }`
  - Success: `{ session, isSessionStale, backgroundScriptData: "...retrieved in Xms" }`
  - Error: `{ session: null, error, duration, isEmergencyResponse: true }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block with timeout cleanup
- **Timeout**: 25 seconds for session creation, 30 seconds for monitoring

#### `refreshSession`
- **Location**: Lines 551-582
- **Behavior**: Forces creation of fresh session
- **Parameters**: `request.sessionType` (defaults to 'standard')
- **Dependencies**:
  - `SessionService.refreshSession(sessionType, true)` - forceNew = true
  - `withTimeout()` wrapper from dependencies
- **Side Effects**: Console logging with timing metrics (🔄, ✅, ❌)
- **Response**:
  - Success: `{ session, isSessionStale: false, backgroundScriptData: "...refreshed in Xms" }`
  - Error: `{ session: null, error, backgroundScriptData: "Failed to refresh session" }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block
- **Timeout**: 20 seconds

#### `getCurrentSession`
- **Location**: Lines 584-708
- **Behavior**: **DEPRECATED** - Use getOrCreateSession instead
- **Dependencies**:
  - `StorageService.getSettings()`
  - `SessionService.getOrCreateSession(sessionType)`
- **Complex Logic**:
  - Determines session type from interview mode settings (lines 684-691)
  - Contains large block of commented-out migration code (lines 587-676)
- **Side Effects**: Console warning (⚠️) about deprecation
- **Response**: `{ session }` or `{ error: "Failed to get current session", session: [] }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block
- **Note**: Kept for backward compatibility only

#### `manualSessionCleanup`
- **Location**: Lines 711-723
- **Behavior**: Manually triggers stalled session cleanup
- **Dependencies**: `cleanupStalledSessions()` from dependencies
- **Side Effects**: Console logging (🧹, ✅, ❌)
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getSessionAnalytics`
- **Location**: Lines 729-756
- **Behavior**: Provides analytics on stalled sessions and cleanup history
- **Dependencies**:
  - `SessionService.detectStalledSessions()`
  - `chrome.storage.local.get(["sessionCleanupAnalytics"])`
- **Response Structure**:
  ```javascript
  {
    stalledSessions: number,
    stalledByType: { [classification]: count },
    recentCleanups: [] // last 5 cleanup events
  }
  ```
- **Side Effects**: Console logging (📊, ✅, ❌)
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `classifyAllSessions`
- **Location**: Lines 758-778
- **Behavior**: Classifies state of all sessions in database
- **Dependencies**:
  - `SessionService.getAllSessionsFromDB()`
  - `SessionService.classifySessionState(session)`
- **Response**:
  ```javascript
  {
    classifications: [
      { id, origin, status, classification, lastActivity }
    ]
  }
  ```
- **Side Effects**: Console logging (🔍, ✅, ❌)
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `generateSessionFromTracking`
- **Location**: Lines 780-792
- **Behavior**: Manually triggers session generation from tracking data
- **Dependencies**: `SessionService.checkAndGenerateFromTracking()`
- **Side Effects**: Console logging (🎯, ✅, 📝, ❌)
- **Response**: `{ session }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getSessionMetrics`
- **Location**: Lines 794-806
- **Behavior**: Retrieves separated session metrics
- **Parameters**: `request.options || {}`
- **Dependencies**: `getSessionMetrics(options)`
- **Side Effects**: Console logging (📊, ✅, ❌)
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `checkInterviewFrequency`
- **Location**: Lines 810-841
- **Behavior**: Checks if interview session should be created based on frequency settings
- **Dependencies**:
  - `StorageService.getSettings()`
  - `SessionService.shouldCreateInterviewSession(frequency, mode)`
  - `SessionService.createInterviewSession(mode)`
- **Complex Logic**:
  - Checks frequency requirements (lines 814-816)
  - Creates interview session if needed (lines 818-822)
- **Side Effects**: Console logging (🕐, ❌)
- **Response**:
  ```javascript
  {
    session: session || null,
    backgroundScriptData: "Frequency-based interview session created" | "No interview session needed"
  }
  ```
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getInterviewReadiness`
- **Location**: Lines 843-861
- **Behavior**: Assesses user readiness for interview sessions
- **Dependencies**: `InterviewService.assessInterviewReadiness()`
- **Side Effects**: Console logging (🎯, ✅, ❌)
- **Response**: Readiness assessment or fallback with all modes unlocked
- **Fallback Response**:
  ```javascript
  {
    interviewLikeUnlocked: true,
    fullInterviewUnlocked: true,
    reasoning: "Fallback mode - all modes available",
    metrics: { accuracy: 0, masteredTagsCount: 0, totalTags: 0, transferReadinessScore: 0 }
  }
  ```
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `completeInterviewSession`
- **Location**: Lines 887-906
- **Behavior**: Completes interview session with validation
- **Parameters**: `request.sessionId`
- **Dependencies**: `SessionService.checkAndCompleteInterviewSession(sessionId)`
- **Side Effects**: Console logging (🎯, ✅, ❌)
- **Response**:
  ```javascript
  {
    completed: boolean,
    unattemptedProblems: [],
    backgroundScriptData: "..."
  }
  ```
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 8. Interview Analytics (1 handler)

#### `getInterviewAnalytics`
- **Location**: Lines 865-885
- **Behavior**: Retrieves interview session analytics
- **Parameters**: `request.filters`
- **Dependencies**: `getInterviewAnalyticsData(filters)`
- **Side Effects**: Console logging (🎯, ✅, ❌)
- **Response**:
  ```javascript
  {
    analytics: [],
    metrics: {},
    recommendations: [],
    backgroundScriptData: "..."
  }
  ```
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 9. Adaptive Limits & Navigation (2 handlers)

#### `getLimits`
- **Location**: Lines 909-951
- **Behavior**: Gets adaptive time limits for problem
- **Parameters**: `request.id` (problem ID)
- **Dependencies**: `adaptiveLimitsService.getLimits(problemId)`
- **Side Effects**: Extensive console logging (🔍, ✅, ❌)
- **Response Transformation**:
  ```javascript
  {
    limits: {
      limit: limitsConfig.difficulty,
      Time: limitsConfig.recommendedTime,
      adaptiveLimits: limitsConfig // Full adaptive data
    }
  }
  ```
- **Response**: `{ limits }` or `{ error: "Failed to get limits: ..." }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `navigate`
- **Location**: Lines 954-959
- **Behavior**: Handles navigation requests
- **Parameters**: `request.route`, `request.time`
- **Dependencies**: `NavigationService.navigate(route, time)`
- **Response**: `{ result: "success" }` or `{ result: "error" }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 10. Dashboard Data (16 handlers)

#### `getDashboardStatistics`
- **Location**: Lines 961-967
- **Behavior**: Gets comprehensive dashboard statistics
- **Parameters**: `request.options || {}`
- **Dependencies**: `getDashboardStatistics(options)`
- **Side Effects**: Console logging ("getDashboardStatistics!!!")
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getLearningProgressData`
- **Location**: Lines 1145-1150
- **Behavior**: Gets learning progress metrics
- **Parameters**: `request.options || {}`
- **Dependencies**: `getLearningProgressData(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getGoalsData`
- **Location**: Lines 1152-1185
- **Behavior**: Gets learning goals with coordinated focus areas
- **Parameters**: `request.options || {}`
- **Dependencies**:
  - `FocusCoordinationService.getFocusDecision("session_state")`
  - `StorageService.getSettings()`
  - `getGoalsData(options, context)`
- **Complex Logic**: Uses FocusCoordinationService for unified focus decision (lines 1156-1176)
- **Context Passed**:
  ```javascript
  {
    settings,
    focusAreas,
    userFocusAreas,
    systemFocusTags,
    focusDecision
  }
  ```
- **Side Effects**: Console logging (🎯, ❌)
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getStatsData`
- **Location**: Lines 1187-1192
- **Behavior**: Gets statistics data
- **Parameters**: `request.options || {}`
- **Dependencies**: `getStatsData(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getSessionHistoryData`
- **Location**: Lines 1194-1199
- **Behavior**: Gets session history
- **Parameters**: `request.options || {}`
- **Dependencies**: `getSessionHistoryData(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getProductivityInsightsData`
- **Location**: Lines 1201-1206
- **Behavior**: Gets productivity insights
- **Parameters**: `request.options || {}`
- **Dependencies**: `getProductivityInsightsData(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getTagMasteryData`
- **Location**: Lines 1208-1213
- **Behavior**: Gets tag mastery progression
- **Parameters**: `request.options || {}`
- **Dependencies**: `getTagMasteryData(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getLearningStatus`
- **Location**: Lines 1215-1238
- **Behavior**: Gets learning phase and cadence data
- **Dependencies**: `SessionService.getTypicalCadence()`
- **Response**:
  ```javascript
  {
    totalSessions: cadenceData.totalSessions || 0,
    learningPhase: cadenceData.learningPhase || true,
    confidenceScore: cadenceData.confidenceScore || 0,
    dataSpanDays: cadenceData.dataSpanDays || 0
  }
  ```
- **Error Handling**: Returns zeros/defaults on error
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getFocusAreasData`
- **Location**: Lines 1240-1282
- **Behavior**: Gets focus areas with mastery and graduation status
- **Dependencies**:
  - `StorageService.getSettings()`
  - `TagService.getCurrentLearningState()`
  - `TagService.checkFocusAreasGraduation()`
- **Fallback Logic**: Uses default focus areas if none configured (lines 1249-1252)
- **Default Focus Areas**: `["array", "hash table", "string", "dynamic programming", "tree"]`
- **Response**:
  ```javascript
  {
    result: {
      focusAreas,
      masteryData: [],
      masteredTags: [],
      graduationStatus
    }
  }
  ```
- **Side Effects**: Console logging (🔄, ❌)
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `graduateFocusAreas`
- **Location**: Lines 1284-1296
- **Behavior**: Graduates user from current focus areas
- **Dependencies**: `TagService.graduateFocusAreas()`
- **Side Effects**: Updates focus area graduation state
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getLearningPathData`
- **Location**: Lines 1298-1303
- **Behavior**: Gets learning path visualization data
- **Parameters**: `request.options || {}`
- **Dependencies**: `getLearningPathData(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getMistakeAnalysisData`
- **Location**: Lines 1305-1310
- **Behavior**: Gets mistake analysis and recommendations
- **Parameters**: `request.options || {}`
- **Dependencies**: `getMistakeAnalysisData(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getFocusAreaAnalytics`
- **Location**: Lines 1376-1381
- **Behavior**: Gets focus area analytics
- **Parameters**: `request.options || {}`
- **Dependencies**: `getFocusAreaAnalytics(options)`
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getAvailableTagsForFocus`
- **Location**: Lines 1383-1399
- **Behavior**: Gets tags available for focus selection
- **Parameters**: `request.userId`
- **Dependencies**: `TagService.getAvailableTagsForFocus(userId)`
- **Side Effects**: Extensive console logging (🔍, ❌)
- **Response**: `{ result }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `clearFocusAreaAnalyticsCache`
- **Location**: Lines 1401-1410
- **Behavior**: Clears focus area analytics cache
- **Dependencies**: `clearFocusAreaAnalyticsCache()`
- **Response**: `{ result: "Cache cleared successfully" }` or `{ error: error.message }`
- **Async**: NO - returns `true` immediately
- **Cleanup**: Calls `finishRequest()` before return

#### `getSimilarProblems`
- **Location**: Lines 1412-1492
- **Behavior**: Finds similar problems using relationship map
- **Parameters**: `request.problemId`, `request.limit || 5`
- **Dependencies**:
  - `buildRelationshipMap()`
  - `fetchAllProblems()`
  - `getAllStandardProblems()`
- **Complex Logic**:
  - Builds comprehensive ID mapping (lines 1424-1436)
  - Numeric ID type conversion (line 1439)
  - Relationship strength sorting (lines 1459-1461)
  - ID resolution from multiple sources (lines 1463-1483)
- **Side Effects**: Console logging (🔍, ⚠️, ✅, ❌)
- **Response**: `{ similarProblems: [] }` with debug info on empty relationship map
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `rebuildProblemRelationships`
- **Location**: Lines 1494-1509
- **Behavior**: Rebuilds problem relationship graph
- **Dependencies**: `buildProblemRelationships()`
- **Side Effects**: Console logging (🔄, ✅, ❌)
- **Response**: `{ success: true/false, message/error }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 11. Hint Interactions (4 handlers)

#### `saveHintInteraction`
- **Location**: Lines 1314-1353
- **Behavior**: Saves hint interaction with problem context enrichment
- **Parameters**: `request.interactionData || request.data`, `request.sessionContext || {}`
- **Dependencies**:
  - `getProblem(problemId)` for enrichment
  - `HintInteractionService.saveHintInteraction(enrichedData, sessionContext)`
- **Complex Logic**: Enriches interaction with problem box level and difficulty (lines 1323-1343)
- **Enrichment Fields**: `boxLevel`, `problemDifficulty`
- **Side Effects**: Console logging (💾, ✅, ❌)
- **Response**: `{ interaction }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block
- **Error Handling**: Continues with fallback values if enrichment fails

#### `getInteractionsByProblem`
- **Location**: Lines 1355-1360
- **Behavior**: Gets hint interactions for specific problem
- **Parameters**: `request.problemId`
- **Dependencies**: `HintInteractionService.getInteractionsByProblem(problemId)`
- **Response**: `{ interactions }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getInteractionsBySession`
- **Location**: Lines 1362-1367
- **Behavior**: Gets hint interactions for specific session
- **Parameters**: `request.sessionId`
- **Dependencies**: `HintInteractionService.getInteractionsBySession(sessionId)`
- **Response**: `{ interactions }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getInteractionStats`
- **Location**: Lines 1369-1374
- **Behavior**: Gets hint interaction statistics
- **Parameters**: `request.filters || {}`
- **Dependencies**: `HintInteractionService.getInteractionStats(filters)`
- **Response**: `{ stats }` or `{ error: error.message }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 12. Background Script Health & Testing (4 handlers)

#### `backgroundScriptHealth`
- **Location**: Lines 970-976
- **Behavior**: Gets background script health report
- **Dependencies**: `backgroundScriptHealth.getHealthReport()` from dependencies
- **Side Effects**: Console logging (🏥)
- **Response**: `{ status: "success", data: healthReport }`
- **Async**: NO - returns `true` immediately
- **Cleanup**: Calls `finishRequest()` before return

#### `TEST_FUNCTIONS_AVAILABLE`
- **Location**: Lines 978-992
- **Behavior**: Checks availability of test functions
- **Side Effects**: Console logging (🧪, 📊)
- **Response**:
  ```javascript
  {
    status: "success",
    data: {
      testSimple: typeof globalThis.testSimple,
      testAsync: typeof globalThis.testAsync,
      runTestsSilent: typeof globalThis.runTestsSilent,
      quickHealthCheck: typeof globalThis.quickHealthCheck,
      backgroundScriptLoaded: true,
      timestamp: Date.now()
    }
  }
  ```
- **Async**: NO - returns `true` immediately
- **Cleanup**: Calls `finishRequest()` before return

#### `RUN_SIMPLE_TEST`
- **Location**: Lines 994-1005
- **Behavior**: Runs simple test function
- **Dependencies**: `globalThis.testSimple()`
- **Side Effects**: Console logging (🧪, ✅, ❌)
- **Response**: `{ status: "success/error", data/error }`
- **Async**: NO - returns `true` immediately (sync test)
- **Cleanup**: Calls `finishRequest()` before return

#### `emergencyReset`
- **Location**: Lines 1007-1012
- **Behavior**: Triggers emergency reset of background script health
- **Dependencies**: `backgroundScriptHealth.emergencyReset()` from dependencies
- **Side Effects**: Console warning (🚑)
- **Response**: `{ status: "success", message: "Emergency reset completed" }`
- **Async**: NO - returns `true` immediately
- **Cleanup**: Calls `finishRequest()` before return

---

### 13. Strategy Data (3 handlers)

#### `getStrategyMapData`
- **Location**: Lines 1015-1024
- **Behavior**: Gets complete strategy map data
- **Dependencies**: `getStrategyMapData()` from dependencies
- **Side Effects**: Console logging (🗺️, ❌)
- **Response**: `{ status: "success", data }` or `{ status: "error", error }`
- **Async**: YES - returns `true`
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getStrategyForTag`
- **Location**: Lines 1027-1073
- **Behavior**: Gets strategy for specific tag with caching
- **Parameters**: `request.tag`
- **Dependencies**:
  - `getCachedResponse(cacheKey)` from dependencies
  - `getStrategyForTag(tag)`
  - `setCachedResponse(cacheKey, response)` from dependencies
- **Cache Key**: `strategy_${request.tag}`
- **Caching Logic**: Checks cache first, sets cache on miss (lines 1029-1038, 1055)
- **Side Effects**: Extensive console logging (🔍, ❌)
- **Response**: `{ status: "success", data: strategy }` or `{ status: "error", error }`
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getStrategiesForTags`
- **Location**: Lines 1075-1109
- **Behavior**: Bulk fetch strategies for multiple tags
- **Parameters**: `request.tags` (array)
- **Dependencies**: `getStrategyForTag(tag)` for each tag
- **Complex Logic**: Uses Promise.all with individual error handling (lines 1083-1096)
- **Side Effects**: Console logging (🎯, ❌)
- **Response**: `{ status: "success", data: strategies }` where strategies is object keyed by tag
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block
- **Error Handling**: Individual tag errors are caught and logged but don't fail the request

#### `isStrategyDataLoaded`
- **Location**: Lines 1111-1142
- **Behavior**: Checks if strategy data is loaded
- **Dependencies**: `isStrategyDataLoaded()`
- **Side Effects**: Extensive console logging (🔍)
- **Response**: `{ status: "success", data: loaded }` or `{ status: "error", error }`
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 14. Database Proxy (1 handler)

#### `DATABASE_OPERATION`
- **Location**: Lines 1512-1549
- **Behavior**: Generic database operation proxy
- **Parameters**: `request.operation`, `request.params`
- **Dependencies**:
  - `getRecord(storeName, id)`
  - `addRecord(storeName, record)`
  - `updateRecord(storeName, id, record)`
  - `deleteRecord(storeName, id)`
  - `getAllFromStore(storeName)`
- **Supported Operations**: getRecord, addRecord, updateRecord, deleteRecord, getAllFromStore
- **Side Effects**: Console logging (📊, 📝, ✅, ❌)
- **Response**: `{ data: result }` or `{ error: error.message }`
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block
- **Error Handling**: Throws error for unknown operations

---

### 15. Session Consistency & Habits (3 handlers)

#### `getSessionPatterns`
- **Location**: Lines 1552-1578
- **Behavior**: Gets session patterns for consistency analysis
- **Dependencies**:
  - `SessionService.getCurrentStreak()`
  - `SessionService.getTypicalCadence()`
  - `SessionService.getWeeklyProgress()`
- **Complex Logic**: Parallel fetching with Promise.all (lines 1558-1562)
- **Response**:
  ```javascript
  {
    result: {
      currentStreak,
      cadence,
      weeklyProgress,
      lastUpdated: new Date().toISOString()
    }
  }
  ```
- **Side Effects**: Console logging (🔍, ✅, ❌)
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block

#### `checkConsistencyAlerts`
- **Location**: Lines 1580-1609
- **Behavior**: Checks for consistency alerts and reminders
- **Dependencies**:
  - `StorageService.getSettings()`
  - `SessionService.checkConsistencyAlerts(reminderSettings)`
- **Reminder Settings Default**: `{ enabled: false }`
- **Side Effects**: Console logging (🔔, 🔍, ✅, ❌)
- **Response**:
  ```javascript
  {
    result: {
      hasAlerts: false,
      reason: "check_failed",
      alerts: [],
      error: error.message
    }
  }
  ```
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block
- **Error Handling**: Returns safe fallback with error message

#### `getStreakRiskTiming`
- **Location**: Lines 1611-1625
- **Behavior**: Gets streak risk timing analysis
- **Dependencies**: `SessionService.getStreakRiskTiming()`
- **Side Effects**: Console logging (🔥, ✅, ❌)
- **Response**: `{ result: streakTiming }` or `{ error: error.message }`
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block

#### `getReEngagementTiming`
- **Location**: Lines 1627-1641
- **Behavior**: Gets re-engagement timing analysis
- **Dependencies**: `SessionService.getReEngagementTiming()`
- **Side Effects**: Console logging (👋, ✅, ❌)
- **Response**: `{ result: reEngagementTiming }` or `{ error: error.message }`
- **Async**: YES - returns `true` (wrapped in async IIFE)
- **Cleanup**: Calls `finishRequest()` in finally block

---

### 16. Default Case

#### `default`
- **Location**: Lines 1643-1646
- **Behavior**: Handles unknown request types
- **Response**: `{ error: "Unknown request type" }`
- **Async**: NO - returns `false`
- **Cleanup**: Calls `finishRequest()` before return

---

## Critical Behavioral Patterns

### 1. Asynchronous Response Handling
- **52 handlers** return `true` to keep message channel open
- **12 handlers** return `true` but complete synchronously
- **1 handler** (default) returns `false`
- **Pattern**: All async operations use `.then().catch().finally(finishRequest)` or async IIFE with finally block

### 2. Error Handling Strategies

#### Strategy A: Try-Catch with Error Response (42 handlers)
```javascript
.catch((error) => {
  console.error("❌ Error:", error);
  sendResponse({ error: error.message });
})
.finally(finishRequest);
```

#### Strategy B: Try-Catch with Fallback Response (3 handlers)
- `getInterviewReadiness`: Returns unlocked fallback
- `checkConsistencyAlerts`: Returns safe no-alerts state
- `getLearningStatus`: Returns zeros/defaults

#### Strategy C: Sync Try-Catch (1 handler)
- `RUN_SIMPLE_TEST`: Catches sync errors immediately

#### Strategy D: No Error Handling (9 handlers)
- Simple acknowledgment handlers
- Cache clearing operations
- Health check handlers

### 3. Cache Management

#### Cache Invalidation Points
1. **Settings Cache** (`clearSettingsCache`):
   - Clears keys: `settings_all`, `settings_*`
   - Also calls `StorageService.clearSettingsCache()`

2. **Session Cache** (`clearSessionCache`):
   - Clears keys: `createSession`, `getActiveSession`, `session_*`

3. **Dashboard Cache** (`addProblem`):
   - Clears keys: `stats_data`, `progress_data`, `sessions_data`, `mastery_data`, `productivity_data`, `learning_path_data`

4. **Focus Analytics Cache** (`clearFocusAreaAnalyticsCache`):
   - Calls function to clear focus analytics

#### Cache Usage Points
1. **Strategy Cache** (`getStrategyForTag`):
   - Cache key: `strategy_${tag}`
   - Read from `getCachedResponse()`
   - Write to `setCachedResponse()`

### 4. Side Effects Tracking

#### Chrome Storage Writes (1 location)
- `setSettings`: Writes to `chrome.storage.local` for theme sync (lines 267-274)

#### Cross-Tab Messaging (1 location)
- `problemSubmitted`: Broadcasts to all tabs via `chrome.tabs.sendMessage()` (lines 412-426)

#### Console Logging (All handlers)
- Used extensively for debugging and monitoring
- Emoji prefixes for visual parsing (📌, ✅, ❌, 🔍, etc.)

#### IndexedDB Operations (Via Services)
- StorageService operations: 7 handlers
- ProblemService operations: 7 handlers
- SessionService operations: 12 handlers
- AttemptsService operations: 1 handler
- TagService operations: 4 handlers
- HintInteractionService operations: 4 handlers
- Database proxy: 1 handler

### 5. Dependencies Object Usage

Required dependencies passed to routeMessage:
- `responseCache`: Map for caching
- `backgroundScriptHealth`: Health monitoring object
- `withTimeout`: Timeout wrapper function
- `cleanupStalledSessions`: Session cleanup function
- `getStrategyMapData`: Strategy map data function
- `getCachedResponse`: Cache getter
- `setCachedResponse`: Cache setter
- `checkOnboardingStatus`: Onboarding checker
- `completeOnboarding`: Onboarding completer

---

## Test Coverage Assessment

### Current Test Infrastructure
Located in `chrome-extension-app/src/shared/utils/`:
- `sessionTesting.js`: SessionTester, TestScenarios
- `comprehensiveSessionTesting.js`: ComprehensiveSessionTester, ComprehensiveTestScenarios
- `minimalSessionTesting.js`: MinimalSessionTester
- `silentSessionTesting.js`: SilentSessionTester
- `integrationTesting.js`: TagProblemIntegrationTester
- `dynamicPathOptimizationTesting.js`: DynamicPathOptimizationTester
- `realSystemTesting.js`: RealSystemTester
- `testDataIsolation.js`: TestDataIsolation
- `relationshipSystemTesting.js`: RelationshipSystemTester

### Coverage Gaps
1. **Message Routing**: No tests for individual message handlers
2. **Error Paths**: Limited testing of error scenarios
3. **Cache Logic**: No dedicated cache behavior tests
4. **Cross-Tab Messaging**: No tests for `problemSubmitted` broadcast
5. **Timeout Handling**: No tests for timeout scenarios in `getOrCreateSession`

### Recommended Test Additions
1. **Unit Tests**: Test each message type handler in isolation
2. **Integration Tests**: Test message flow from content script → background → services
3. **Error Scenario Tests**: Test error handling for each async handler
4. **Cache Tests**: Test cache invalidation and retrieval
5. **Timeout Tests**: Test timeout behavior for session operations

---

## Refactoring Recommendations

### Safe Refactoring Strategy

#### Phase 1: Extract Message Type Groups (Low Risk)
Create separate handler files for each functional domain:
- `handlers/backup.js`: backupIndexedDB, getBackupFile
- `handlers/storage.js`: setStorage, getStorage, removeStorage, getSessionState
- `handlers/onboarding.js`: All 10 onboarding handlers
- `handlers/settings.js`: setSettings, getSettings, clearSettingsCache, clearSessionCache
- `handlers/problems.js`: All 7 problem handlers
- `handlers/sessions.js`: All 12 session handlers
- `handlers/interviews.js`: Interview-related handlers
- `handlers/limits.js`: getLimits, navigate
- `handlers/dashboard.js`: All 16 dashboard handlers
- `handlers/hints.js`: All 4 hint interaction handlers
- `handlers/health.js`: Health check and test handlers
- `handlers/strategy.js`: All 4 strategy handlers
- `handlers/database.js`: DATABASE_OPERATION handler
- `handlers/habits.js`: All 4 consistency/habits handlers

#### Phase 2: Create Router Registry (Medium Risk)
```javascript
const messageHandlers = {
  'backupIndexedDB': backupHandlers.backupIndexedDB,
  'getBackupFile': backupHandlers.getBackupFile,
  // ... etc
};

export async function routeMessage(request, sendResponse, finishRequest, dependencies) {
  const handler = messageHandlers[request.type];
  if (handler) {
    return handler(request, sendResponse, finishRequest, dependencies);
  }
  sendResponse({ error: "Unknown request type" });
  finishRequest();
  return false;
}
```

#### Phase 3: Add Handler Wrapper (Low Risk)
Create standardized wrapper for error handling and logging:
```javascript
function createHandler(name, handlerFn, options = {}) {
  return async (request, sendResponse, finishRequest, dependencies) => {
    try {
      const result = await handlerFn(request, dependencies);
      sendResponse(result);
    } catch (error) {
      console.error(`❌ ${name} error:`, error);
      sendResponse(options.fallback || { error: error.message });
    } finally {
      finishRequest();
    }
    return true;
  };
}
```

#### Phase 4: Standardize Response Formats (High Risk)
- Ensure all handlers return consistent response shapes
- This is HIGH RISK as it affects all callers

---

## Capability Loss Detection Checklist

When refactoring, verify these capabilities are preserved:

### Message Handling
- [ ] All 64 message types are still handled
- [ ] Async channel stays open (returns `true`) for all async handlers
- [ ] `finishRequest()` is called in all code paths

### Error Handling
- [ ] All try-catch blocks are preserved
- [ ] Error responses maintain same format
- [ ] Fallback responses for critical handlers work

### Side Effects
- [ ] Chrome storage write in `setSettings` still happens
- [ ] Cross-tab broadcast in `problemSubmitted` still works
- [ ] Console logging preserved (or intentionally removed)

### Cache Operations
- [ ] Cache reads from `getCachedResponse()` work
- [ ] Cache writes to `setCachedResponse()` work
- [ ] Cache invalidation clears correct keys
- [ ] Cache invalidation in `addProblem` still triggers

### Special Behaviors
- [ ] Interview banner logic in `getOrCreateSession` preserved
- [ ] Timeout monitoring in `getOrCreateSession` and `refreshSession` works
- [ ] Problem enrichment in `saveHintInteraction` still happens
- [ ] Focus coordination in `getGoalsData` still works
- [ ] ID type conversion in `getSimilarProblems` still works
- [ ] Fallback focus areas in `getFocusAreasData` still work

### Dependencies
- [ ] All dependency parameters are passed through
- [ ] Dependency functions are called correctly
- [ ] Service imports are maintained

---

## Function Signature

```javascript
/**
 * Main message routing function
 * Handles all incoming Chrome messages and delegates to appropriate handlers
 *
 * @param {Object} request - The incoming message request
 * @param {Function} sendResponse - Callback to send response
 * @param {Function} finishRequest - Cleanup callback to mark request as complete
 * @param {Object} dependencies - Dependencies from background script
 * @param {Map} dependencies.responseCache - Response cache Map
 * @param {Object} dependencies.backgroundScriptHealth - Health monitoring object
 * @param {Function} dependencies.withTimeout - Timeout wrapper function
 * @param {Function} dependencies.cleanupStalledSessions - Session cleanup function
 * @param {Function} dependencies.getStrategyMapData - Strategy map data function
 * @param {Function} dependencies.getCachedResponse - Cache getter function
 * @param {Function} dependencies.setCachedResponse - Cache setter function
 * @param {Function} dependencies.checkOnboardingStatus - Onboarding status checker
 * @param {Function} dependencies.completeOnboarding - Onboarding completion function
 * @returns {boolean} - True if response will be sent asynchronously
 */
export async function routeMessage(request, sendResponse, finishRequest, dependencies = {})
```

---

## Conclusion

This baseline documents **ALL capabilities** of the routeMessage function before refactoring. Any changes must preserve:
- All 64 message type handlers
- Asynchronous response patterns
- Error handling strategies
- Cache invalidation logic
- Side effects (Chrome storage, tab messaging)
- Special behavioral logic (interview mode, enrichment, fallbacks)
- Dependency injection pattern

Use this document as the **source of truth** when comparing refactored code against original behavior with the capability-guard-linter.
