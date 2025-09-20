# Database Layer

The database layer provides IndexedDB abstraction with a centralized helper system and specialized store utilities. All database access flows through this layer, with services as the only consumers.

## Database Helper (`index.js`)

### Core Database Management

- **Database Name**: "CodeMaster"
- **Current Version**: 47
- **Store Count**: 17 specialized object stores
- **Upgrade Strategy**: Automatic versioned migrations with data preservation

### Key Functions

```javascript
// Primary database connection
await dbHelper.openDB();

// Store access (readonly/readwrite)
const store = await dbHelper.getStore("storeName", "readwrite");

// Index creation utility
dbHelper.ensureIndex(store, indexName, keyPath);
```

## Store Utilities

### 🧮 **attempts.js**

**Purpose**: Individual problem attempt tracking

- `recordAttempt(attemptData)` - Logs problem attempts with timing and success data
- `getAttemptsBySession(sessionId)` - Retrieves all attempts for a session
- `getAttemptHistory(problemId)` - Gets historical attempts for a problem
- `calculateAttemptStatistics()` - Computes success rates and timing metrics

**Attempt Object Structure** (snake_case):
```javascript
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

### 🔄 **sessions.js**

**Purpose**: Learning session management and analytics

- `saveNewSessionToDB(session)` - Creates new session records
- `updateSessionInDB(sessionId, updates)` - Updates session progress
- `getSessionById(sessionId)` - Retrieves specific session data
- `getLatestSession()` - Gets most recent session
- `getSessionPerformance(sessionId)` - Generates performance analysis
- `buildAdaptiveSessionSettings()` - Creates adaptive session configurations

**Session Object Structure** (snake_case):
```javascript
{
  id: sessionId,
  session_type: "standard",
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

### 🧩 **problems.js**

**Purpose**: Problem data and Leitner system management

- `addProblem(problemData)` - Adds new problems with metadata
- `updateProblemInDB(problemId, updates)` - Updates problem state (box levels, stability)
- `fetchAllProblems()` - Retrieves all problems with filters
- `fetchAdditionalProblems(criteria)` - Gets problems matching specific criteria
- `countProblemsByBoxLevel()` - Statistics for Leitner box distribution
- `checkDatabaseForProblem(problemId)` - Checks if problem exists
- `updateProblemsWithRatings()` - Bulk rating updates

### 🏷️ **tag_mastery.js**

**Purpose**: Algorithm pattern mastery tracking

- `calculateTagMastery()` - Recalculates mastery scores across all tags
- `getTagMastery(tag?)` - Retrieves mastery data for specific tag or all tags
- `updateTagMasteryScore(tag, delta)` - Adjusts mastery score
- `getMasteredTags()` - Gets list of mastered algorithm patterns
- `getWeakTags()` - Identifies struggling patterns needing focus

### 🪜 **pattern_ladder.js**

**Purpose**: Progressive difficulty ladder management

- `updatePatternLadder(tag, problemId, success)` - Updates ladder progression
- `getPatternLadder(tag)` - Retrieves ladder state for algorithm pattern
- `getNextLadderProblem(tag)` - Selects next problem in progression
- `calculateLadderCompletion(tag)` - Computes completion percentage

### 📊 **sessionAnalytics.js**

**Purpose**: Detailed session performance analysis

- `storeSessionAnalytics(analyticsData)` - Saves comprehensive session analysis
- `getSessionAnalytics(sessionId)` - Retrieves detailed session metrics
- `getAnalyticsTrends(timeframe)` - Gets performance trends over time
- `generateSessionInsights(sessionId)` - Creates performance-based insights

### 🔍 **standard_problems.js**

**Purpose**: Canonical LeetCode problem database

- `getProblemFromStandardProblems(slug)` - Fetches canonical problem data
- `searchStandardProblems(criteria)` - Searches canonical problem set
- `updateStandardProblem(slug, updates)` - Updates canonical problem data
- `importStandardProblems(problemSet)` - Bulk imports problem data

### 🔗 **problem_relationships.js**

**Purpose**: Problem similarity and relationship graph

- `updateProblemRelationships(session)` - Updates relationship strengths based on session
- `getProblemRelationships(problemId)` - Gets related problems
- `calculateRelationshipStrength(problem1, problem2)` - Computes similarity score
- `maintainRelationshipGraph()` - Periodic relationship graph maintenance

### 🏗️ **tag_relationships.js**

**Purpose**: Algorithm tag classification and connections

- `getTagRelationships(tag?)` - Retrieves tag relationship data
- `updateTagRelationships(relationships)` - Updates tag connection strengths
- `getTagsByClassification(classification)` - Gets tags by tier (Core, Fundamental, Advanced)
- `calculateTagSimilarity(tag1, tag2)` - Computes tag relationship strength

### ⚙️ **limit.js**

**Purpose**: Time and attempt limit management

- `getProblemLimits(problemId)` - Retrieves time limits for problems
- `updateLimits(problemId, limits)` - Updates problem time constraints
- `calculateAdaptiveLimits(difficulty, userLevel)` - Computes personalized limits

### 🗄️ **backupDB.js** & **restoreDB.js**

**Purpose**: Database backup and recovery operations

- `createBackup()` - Generates complete database backup
- `restoreFromBackup(backupData)` - Restores database from backup
- `validateBackup(backupData)` - Verifies backup integrity
- `scheduleAutomaticBackup()` - Sets up periodic backups

### 📝 **common.js**

**Purpose**: Shared database utilities and helpers

- Database connection management
- Common query patterns
- Error handling utilities
- Transaction management helpers

## Database Schema Management

### Version Migration Strategy

```javascript
// Automatic upgrades in index.js
request.onupgradeneeded = (event) => {
  const db = event.target.result;

  // Store creation with proper indexes
  if (!db.objectStoreNames.contains("storeName")) {
    let store = db.createObjectStore("storeName", { keyPath: "id" });
    store.createIndex("by_field", "field", { unique: false });
  }
};
```

### Index Strategy

- **Primary Keys**: Natural keys where possible (leetCodeID, tag), auto-increment for logs
- **Secondary Indexes**: Query-optimized indexes for common access patterns
- **Composite Indexes**: Multi-field indexes for complex queries

### Data Relationships

```
Sessions ↔ Attempts: sessions.id = attempts.sessionId
Problems ↔ Attempts: problems.leetCodeID = attempts.problemId
Tags ↔ Mastery: tag_relationships.id = tag_mastery.tag
Tags ↔ Ladders: tag_relationships.id = pattern_ladders.tag
Sessions ↔ Analytics: sessions.id = session_analytics.sessionId
```

## Performance Optimizations

### Query Optimization

- Strategic use of indexes for common query patterns
- Batch operations for bulk updates
- Transaction batching for related operations
- Cursor-based iteration for large datasets

### Memory Management

- Proper cursor cleanup
- Transaction scoping
- Connection pooling via singleton pattern
- Lazy loading of large datasets

### Error Handling

- Comprehensive error catching and transformation
- Graceful degradation for storage quota issues
- Backup/restore capability for data recovery
- Version migration error handling

## Testing Strategy

Database layer testing focuses on:

- **Schema Integrity**: Version migration testing
- **Data Consistency**: Relationship constraint validation
- **Performance**: Query optimization verification
- **Error Handling**: Failure scenario testing

All database operations are tested via service layer tests to ensure proper integration and error handling.
