# Database Property Standardization Plan

## Executive Summary

This document outlines a comprehensive plan to standardize all property names across the IndexedDB database schema to use **lowercase_with_underscore** naming convention. This critical change will resolve multiple production issues while maintaining data integrity and system functionality.

## Current Critical Issues

### 1. Problem Selection Failure
- **Location**: `problems.js:931-992` (`selectProblemsForTag` function)
- **Issue**: Property mismatches between ladder problems and standard problems
- **Symptom**: Function finds eligible problems but selects 0 due to ID lookup failures
- **Root Cause**: Ladder problems use `leetCodeID`, standard problems use `id`

### 2. Problem Removal Bug
- **Location**: `attemptsService.js:349-356`
- **Issue**: Removes ALL problems from sessions on successful completion
- **Symptom**: Completed sessions show `problems: []` instead of retaining problem list
- **Root Cause**: Filter logic checks multiple conflicting property names (`id`, `leetCodeID`, `problemId`)

### 3. Session Creation Failures
- **Issue**: Sessions only get 2 fallback problems instead of 5 new problems
- **Root Cause**: `fetchAdditionalProblems` selection failures cascade to fallback logic
- **Impact**: Onboarding users don't get proper session lengths

### 4. Tracking Session Attribution
- **Issue**: Problems not properly attributed to correct sessions
- **Root Cause**: Inconsistent session ID property names and references

### 5. Property Casing Inconsistencies
- **Examples**:
  - `ProblemDescription` vs `problemDescription`
  - `Tags` vs `tags`
  - `leetCodeID` vs `leetcode_id`
  - `SessionID` vs `sessionId`

### 6. Session Analytics Processing Failure (CRITICAL)
- **Location**: `sessions.js:859` (`_processAttempts` function)
- **Issue**: Session attempts use camelCase (`attemptId`, `problemId`, `timeSpent`) but analytics processing expects snake_case (`attempt_id`, `problem_id`, `time_spent`)
- **Symptom**: All 12 attempts report `problem_id: undefined`, causing 0 accuracy calculation
- **Root Cause**: `attemptsService.js:403` creates session attempts with camelCase structure
- **Impact**: Sessions stuck in onboarding mode, no adaptive learning progression

## Current Database Schema Analysis

### Problems Store
```javascript
// Current Schema
keyPath: "leetCodeID"
indexes: {
  "by_tag": "tag",
  "by_problem": "problem", 
  "by_review": "review",
  "by_ProblemDescription": "ProblemDescription",  // ❌ Inconsistent casing
  "by_nextProblem": "nextProblem"
}

// Current Object Structure (problems.js:339-358)
{
  id: problemId,                    // ❌ UUID, not used as key
  ProblemDescription: title,        // ❌ Capitalized
  leetCodeID: Number(id),          // ❌ Used as key but mixed case
  Tags: tags || [],                // ❌ Capitalized  
  BoxLevel: 1,                     // ❌ Camel case
  ReviewSchedule: schedule,        // ❌ Camel case
  AttemptStats: { ... }           // ❌ Camel case
}
```

### Standard Problems Store  
```javascript
// Current Schema
keyPath: "id"
indexes: {
  "by_slug": "slug"
}

// JSON Data Structure (LeetCode_Tags_Combined.json)
{
  id: 1,                          // ✅ Consistent
  title: "Two Sum",               // ✅ Lowercase
  slug: "two-sum",               // ✅ Lowercase
  difficulty: "Easy",            // ✅ Lowercase  
  tags: ["Array", "Hash Table"]  // ✅ Lowercase
}
```

### Sessions Store
```javascript
// Current Schema  
keyPath: "id"
indexes: {
  "by_date": "date",
  "by_sessionType": "sessionType",           // ❌ Camel case
  "by_sessionType_status": ["sessionType", "status"],
  "by_lastActivityTime": "lastActivityTime"  // ❌ Camel case
}
```

### Attempts Store
```javascript
// Current Schema
keyPath: "id" 
indexes: {
  "by_date": "date",
  "by_problem_and_date": ["problemId", "date"],  // ✅ Snake case index
  "by_problemId": "problemId",                   // ❌ Camel case property
  "by_sessionId": "sessionId"                    // ❌ Camel case property
}
```

## Proposed Standardized Schema

### Naming Convention: `lowercase_with_underscore`

### Problems Store (Standardized)
```javascript
// New Schema
keyPath: "problem_id"  // UUID primary key for user problems
indexes: {
  "by_tag": "tags",              // Multi-entry for tag array
  "by_title": "title", 
  "by_review_schedule": "review_schedule",
  "by_box_level": "box_level",
  "by_session_id": "session_id",
  "by_leetcode_id": "leetcode_id"  // Index for LeetCode ID lookups
}

// New Object Structure
{
  problem_id: problemId,                       // UUID primary key for internal references
  leetcode_id: problemData.leetcode_id,       // References standard_problems.id
  title: problemData.title.toLowerCase(),     // Standardized from ProblemDescription
  tags: problemData.tags || [],               // Lowercase
  box_level: 1,                               // Snake case
  review_schedule: problemData.reviewSchedule,// Snake case
  cooldown_status: false,                     // Snake case
  perceived_difficulty: 5,                    // Snake case
  consecutive_failures: 0,                    // Snake case
  stability: 1.0,                            // Lowercase
  attempt_stats: {                           // Snake case
    total_attempts: 0,                       // Snake case
    successful_attempts: 0,                  // Snake case
    unsuccessful_attempts: 0                 // Snake case
  },
  leetcode_address: address,                 // Snake case
  session_id: session.id                     // Snake case
}
```

### Standard Problems Store (No Changes Needed)
```javascript
// Already Consistent
keyPath: "id"
indexes: {
  "by_slug": "slug"
}
// Objects already use lowercase properties
```

### Sessions Store (Standardized)
```javascript
// New Schema
keyPath: "id"
indexes: {
  "by_date": "date",
  "by_session_type": "session_type",                    // Snake case
  "by_session_type_status": ["session_type", "status"], // Snake case
  "by_last_activity_time": "last_activity_time",        // Snake case
  "by_origin": "origin",
  "by_origin_status": ["origin", "status"]
}

// New Object Structure
{
  id: sessionId,
  session_type: "standard",          // Snake case
  status: "completed",
  problems: [],
  attempts: [                        // Session attempts array (snake_case)
    {
      attempt_id: "uuid",            // Snake case
      problem_id: "uuid",            // Database UUID (snake_case)
      leetcode_id: 21,               // LeetCode ID for lookups (snake_case)
      success: true,
      time_spent: 900,               // Snake case
      source: "session_problem"
    }
  ],
  created_date: new Date(),          // Snake case
  last_activity_time: new Date(),    // Snake case
  origin: "generator",               // Snake case
  current_problem_index: 0           // Snake case
}
```

### Attempts Store (Standardized)
```javascript
// New Schema
keyPath: "id"
indexes: {
  "by_date": "date",
  "by_problem_and_date": ["problem_id", "date"],        // Snake case
  "by_problem_id": "problem_id",                        // Snake case  
  "by_session_id": "session_id",                        // Snake case
  "by_leetcode_id": "leetcode_id"                       // New index for lookups
}

// New Object Structure
{
  id: attemptId,                           // Auto-increment attempt ID
  problem_id: problemId,                   // References problems.problem_id (UUID)
  leetcode_id: problem.leetcode_id,        // References standard_problems.id (numeric)
  success: attemptData.Success,            // Lowercase
  attempt_date: attemptData.AttemptDate,   // Snake case
  time_spent: attemptData.TimeSpent,       // Snake case
  perceived_difficulty: 5,                 // Snake case
  comments: attemptData.comments || "",    // Lowercase
  box_level: 1,                           // Snake case
  next_review_date: null,                 // Snake case
  session_id: session.id,                 // Snake case
  exceeded_recommended_time: false,        // Snake case
  overage_time: 0,                        // Snake case
  user_intent: "completed",               // Snake case
  time_warning_level: 0                   // Snake case
}
```

## Store Interaction Analysis

### Problems ↔ Standard Problems
**Current Issues:**
- Problems use `leetCodeID` as key, Standard Problems use `id`
- Lookup: `standardProblems.find(p => p.id === problem.leetCodeID)` ✅ Works
- Reverse: `problems.find(p => p.leetCodeID === standardProblem.id)` ✅ Works

**After Standardization:**
- Problems use `problem_id` as UUID primary key, `leetcode_id` for references
- Standard Problems use `id` as numeric primary key
- **Lookup**: `standardProblems.find(p => p.id === problem.leetcode_id)` ✅ Clean relationship
- **Reverse**: `problems.find(p => p.leetcode_id === standardProblem.id)` ✅ Clean relationship

### Problems ↔ Attempts  
**Current Issues:**
- Attempts reference `problemId` (UUID) but also need `leetCodeID` for problem lookups
- Complex filtering logic in attemptsService.js

**After Standardization:**
- **Direct Problem Reference**: `problems.find(p => p.problem_id === attempt.problem_id)` 
- **LeetCode Lookups**: `attempts.filter(a => a.leetcode_id === leetcode_id)`
- **Simplified Logic**: Single UUID relationship for problem ownership

### Sessions ↔ Problems
**Current Issues:**
- Sessions contain problem arrays with mixed ID types
- Session attribution failures

**After Standardization:**
- **Direct Attribution**: `problems.filter(p => p.session_id === session.id)`
- **Consistent References**: All problems include `session_id` field
- **Clean Ownership**: Sessions own problems via UUID references

### Sessions ↔ Attempts
**Current Issues:**
- SessionID vs sessionId inconsistencies

**After Standardization:**
- **Direct Session Attempts**: `attempts.filter(a => a.session_id === session.id)`
- **Consistent Naming**: All use `session_id` property
- **No Ambiguity**: Clear session ownership

## Migration Strategy

### Phase 1: Database Schema Updates
1. **Update Store Creation Functions** (`storeCreation.js`)
   - Modify `createProblemsStore()` to use new indexes
   - Update `createSessionsStore()` with snake_case indexes  
   - Update `createAttemptsStore()` with snake_case indexes

2. **Version Bump** (`index.js`)
   - Increment database version to force schema recreation
   - Add migration logic in upgrade handler

### Phase 2: Object Creation Updates
1. **Problems Object Creation** (`problems.js:addProblem`)
   - Update all property names to snake_case
   - Change primary key usage to `leetcode_id`

2. **Sessions Object Creation** (`sessionService.js`)
   - Standardize all session property names

3. **Attempts Object Creation** (`attemptsService.js`)
   - Update attempt object structure
   - Fix filtering logic with consistent property names

### Phase 3: Service Layer Updates
1. **Problem Service** (`problemService.js`)
   - Update all database queries to use new property names
   - Fix `selectProblemsForTag` function

2. **Attempts Service** (`attemptsService.js`)
   - Fix problem removal filter logic
   - Update all property references

3. **Session Service** (`sessionService.js`)
   - Update session creation and management

### Phase 4: Query Updates
1. **Index Usage Updates**
   - Update all `store.index()` calls to use new index names
   - Update property access in query results

2. **Filter Logic Updates**  
   - Update all `.filter()`, `.find()`, `.map()` operations
   - Ensure consistent property name usage

## Data Migration Plan

### Migration Function Structure
```javascript
async function migrateToStandardizedSchema(db, transaction) {
  // 1. Migrate Problems Store
  await migrateProblemStore(db, transaction);
  
  // 2. Migrate Sessions Store  
  await migrateSessionsStore(db, transaction);
  
  // 3. Migrate Attempts Store
  await migrateAttemptsStore(db, transaction);
  
  // 4. Update Cross-References
  await updateCrossReferences(db, transaction);
}
```

### Problems Store Migration
```javascript
async function migrateProblemStore(db, transaction) {
  const oldStore = transaction.objectStore("problems");
  const problems = [];
  
  // Read all existing problems
  const cursor = oldStore.openCursor();
  cursor.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const oldProblem = cursor.value;
      
      // Transform to new schema
      const newProblem = {
        problem_id: oldProblem.id || uuidv4(),  // Preserve existing UUID or create new
        leetcode_id: oldProblem.leetCodeID,     // LeetCode ID for standard problem reference
        title: oldProblem.ProblemDescription,
        tags: oldProblem.Tags || [],
        box_level: oldProblem.BoxLevel || 1,
        review_schedule: oldProblem.ReviewSchedule,
        cooldown_status: oldProblem.CooldownStatus || false,
        perceived_difficulty: oldProblem.perceivedDifficulty || 5,
        consecutive_failures: oldProblem.ConsecutiveFailures || 0,
        stability: oldProblem.Stability || 1.0,
        attempt_stats: {
          total_attempts: oldProblem.AttemptStats?.TotalAttempts || 0,
          successful_attempts: oldProblem.AttemptStats?.SuccessfulAttempts || 0,  
          unsuccessful_attempts: oldProblem.AttemptStats?.UnsuccessfulAttempts || 0
        },
        leetcode_address: oldProblem.LeetCodeAddress,
        session_id: oldProblem.sessionId || null
      };
      
      problems.push(newProblem);
      cursor.continue();
    }
  };
  
  // Write to new schema after store recreation
  // ...implementation details
}
```

## Risk Assessment & Mitigation

### High Risks
1. **Data Loss**: Incorrect migration could lose user progress
   - **Mitigation**: Create backup before migration, rollback plan
   
2. **Service Failures**: Property name changes could break functionality  
   - **Mitigation**: Comprehensive testing, gradual rollout

3. **Cross-Reference Corruption**: ID mappings could be lost
   - **Mitigation**: Maintain ID mapping tables during migration

### Medium Risks  
1. **Performance Impact**: Schema changes might affect query performance
   - **Mitigation**: Test query performance before/after

2. **Extension Breaking**: Chrome extension might fail to load
   - **Mitigation**: Error handling, fallback mechanisms

### Low Risks
1. **User Experience**: Temporary data inconsistencies
   - **Mitigation**: Show loading states during migration

## Testing Strategy

### Pre-Migration Testing
1. **Backup Creation**: Test backup/restore functionality
2. **Schema Validation**: Verify new schema structure  
3. **Migration Logic**: Test migration functions with sample data

### Post-Migration Testing  
1. **Data Integrity**: Verify all data migrated correctly
2. **Functionality Testing**: Test all major user flows
3. **Performance Testing**: Verify query performance maintained

### Rollback Testing
1. **Rollback Procedure**: Test ability to revert changes
2. **Data Recovery**: Verify backup restoration works

## Implementation Timeline

### Week 1: Preparation
- [ ] Create comprehensive backup system
- [ ] Update database schema definitions
- [ ] Create migration functions

### Week 2: Object Structure Updates  
- [ ] Update all object creation code
- [ ] Update service layer property references
- [ ] Update query logic

### Week 3: Testing & Validation
- [ ] Unit tests for all changed functions
- [ ] Integration testing for cross-store operations
- [ ] Performance testing

### Week 4: Deployment & Monitoring
- [ ] Gradual rollout with monitoring
- [ ] User acceptance testing
- [ ] Performance monitoring

## Success Criteria

### Functional Requirements
- [ ] Sessions generate full problem counts (5 instead of 2)
- [ ] Problems not removed from completed sessions  
- [ ] Tag-based problem selection works correctly
- [ ] Session attribution works properly
- [ ] All database operations maintain performance

### Technical Requirements
- [ ] All property names use snake_case consistently
- [ ] All cross-store references work correctly
- [ ] Database queries use correct index names
- [ ] No data loss during migration
- [ ] Rollback capability maintained

## Corrected ID Structure Summary

### Primary Keys & Relationships:
1. **`problems.problem_id`** (UUID) - Primary key for user problems
2. **`problems.leetcode_id`** (numeric) - References `standard_problems.id`  
3. **`attempts.problem_id`** (UUID) - References `problems.problem_id`
4. **`attempts.leetcode_id`** (numeric) - References `standard_problems.id`
5. **`standard_problems.id`** (numeric) - LeetCode problem identifier

### Key Relationships:
```javascript
// Problems ↔ Standard Problems
standardProblems.find(p => p.id === problem.leetcode_id)

// Attempts ↔ Problems  
problems.find(p => p.problem_id === attempt.problem_id)

// Sessions ↔ Problems
problems.filter(p => p.session_id === session.id)

// Sessions ↔ Attempts
attempts.filter(a => a.session_id === session.id)
```

This structure maintains clean relational integrity with UUID primary keys for user-generated data and numeric references to standard LeetCode problems.

## Conclusion

This standardization plan addresses all identified critical issues while maintaining system stability and data integrity. The snake_case naming convention combined with the corrected UUID-based primary key structure will provide consistency across the entire database schema and eliminate the property mismatch issues causing production failures.

The phased approach with comprehensive testing and rollback capabilities ensures minimal risk to user data and system functionality. Upon completion, the system will have a clean, consistent database schema that supports reliable problem selection, session management, and user progress tracking.