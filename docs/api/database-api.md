# Database API Reference

The database layer provides IndexedDB abstraction with a centralized helper system and specialized store utilities. All database access flows through this layer, with services as the only consumers.

## Database Overview

- **Database Name**: "review"
- **Current Version**: 25
- **Store Count**: 13 specialized object stores
- **Upgrade Strategy**: Automatic versioned migrations with data preservation

## Core Database Helper (`index.js`)

### Primary Functions

```javascript
// Primary database connection
await dbHelper.openDB();

// Store access (readonly/readwrite)
const store = await dbHelper.getStore("storeName", "readwrite");

// Index creation utility
dbHelper.ensureIndex(store, indexName, keyPath);
```

## Store APIs

### 🧮 **attempts.js** - Problem Attempt Tracking

**Purpose**: Individual problem attempt tracking with timing and success data

```javascript
// Record a problem attempt
await recordAttempt({
  sessionId: "session-123",
  problemId: "two-sum", 
  success: true,
  timeSpent: 1200, // milliseconds
  boxLevel: 2
});

// Get attempts for a session
const attempts = await getAttemptsBySession("session-123");

// Get historical attempts for a problem
const history = await getAttemptHistory("two-sum");

// Calculate success rates and timing metrics
const stats = await calculateAttemptStatistics();
```

### 🔄 **sessions.js** - Learning Session Management

**Purpose**: Structured learning sessions with performance tracking

```javascript
// Create new session
await saveNewSessionToDB({
  id: "session-123",
  problems: ["two-sum", "valid-parentheses"],
  startTime: Date.now(),
  settings: { difficulty: "mixed", count: 5 }
});

// Update session progress
await updateSessionInDB("session-123", {
  completedProblems: 2,
  currentProblem: "valid-parentheses"
});

// Get session with performance analysis
const session = await getSessionById("session-123");
const performance = await getSessionPerformance("session-123");
```

### 🧩 **problems.js** - Problem Data & Leitner System

**Purpose**: Problem data with Leitner system metadata (box levels, stability scores)

```javascript
// Add new problem with Leitner metadata
await addProblem({
  leetCodeID: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  tags: ["Array", "Hash Table"],
  boxLevel: 1,
  stability: 2.5,
  lastReviewed: Date.now()
});

// Update problem state (box levels, stability)
await updateProblemInDB("two-sum", {
  boxLevel: 3,
  stability: 5.2,
  consecutiveCorrect: 2
});

// Get problems with filters
const problems = await fetchAllProblems({
  tags: ["Array"],
  boxLevel: [2, 3],
  difficulty: "Easy"
});

// Statistics for Leitner box distribution
const distribution = await countProblemsByBoxLevel();
// Returns: { box1: 45, box2: 23, box3: 12, box4: 5 }
```

### 🏷️ **tag_mastery.js** - Algorithm Pattern Mastery

**Purpose**: Tracks mastery progress per algorithm pattern

```javascript
// Recalculate mastery scores across all tags
await calculateTagMastery();

// Get mastery data for specific tag
const arrayMastery = await getTagMastery("Array");
// Returns: { tag: "Array", masteryLevel: 0.75, problems: 23, mastered: 17 }

// Get all mastery data
const allMastery = await getTagMastery();

// Update mastery score
await updateTagMasteryScore("Array", 0.05); // +5% improvement

// Get mastered algorithm patterns
const mastered = await getMasteredTags(); // masteryLevel >= 0.8

// Get struggling patterns needing focus
const weak = await getWeakTags(); // masteryLevel < 0.4
```

### 🪜 **pattern_ladder.js** - Progressive Difficulty Ladders

**Purpose**: Manages progression through algorithm pattern difficulty levels

```javascript
// Update ladder progression after attempt
await updatePatternLadder("Array", "two-sum", true); // success

// Get ladder state for algorithm pattern
const ladder = await getPatternLadder("Array");
// Returns: { tag: "Array", currentLevel: 3, problems: [...], completion: 0.6 }

// Get next problem in progression
const nextProblem = await getNextLadderProblem("Array");

// Calculate completion percentage
const completion = await calculateLadderCompletion("Array"); // 0.75 = 75%
```

### 📊 **sessionAnalytics.js** - Detailed Session Analysis

**Purpose**: Comprehensive session performance analysis and insights

```javascript
// Save detailed session analysis
await storeSessionAnalytics({
  sessionId: "session-123",
  totalTime: 3600000, // 1 hour
  problemsAttempted: 5,
  problemsCompleted: 4,
  averageTime: 720000, // 12 minutes
  tagPerformance: { "Array": 0.8, "String": 0.6 },
  insights: ["Strong array performance", "Need string practice"]
});

// Get detailed session metrics
const analytics = await getSessionAnalytics("session-123");

// Get performance trends over time
const trends = await getAnalyticsTrends("last30days");
// Returns weekly/monthly accuracy and timing trends
```

### 🔍 **standard_problems.js** - Canonical Problem Database

**Purpose**: Reference database of all LeetCode problems with metadata

```javascript
// Fetch canonical problem data
const problem = await getProblemFromStandardProblems("two-sum");
// Returns: { slug: "two-sum", title: "Two Sum", difficulty: "Easy", ... }

// Search canonical problem set
const results = await searchStandardProblems({
  tags: ["Array", "Hash Table"],
  difficulty: "Easy",
  companies: ["Google", "Amazon"]
});

// Update canonical problem data
await updateStandardProblem("two-sum", {
  acceptanceRate: 0.52,
  companies: ["Google", "Amazon", "Microsoft"]
});
```

### 🔗 **problem_relationships.js** - Problem Similarity Graph

**Purpose**: Maintains relationships between similar problems

```javascript
// Update relationships based on session data
await updateProblemRelationships({
  sessionId: "session-123",
  problems: ["two-sum", "three-sum", "four-sum"]
});

// Get related problems
const related = await getProblemRelationships("two-sum");
// Returns: [{ problemId: "three-sum", strength: 0.85 }, ...]

// Calculate similarity score between problems
const similarity = await calculateRelationshipStrength("two-sum", "three-sum");
// Returns: 0.75 (75% similar)
```

### 🏗️ **tag_relationships.js** - Algorithm Tag Classification

**Purpose**: Manages algorithm tag connections and classifications

```javascript
// Get tag relationship data
const tagData = await getTagRelationships("Array");
// Returns: { classification: "Core", related: ["Hash Table", "Two Pointers"] }

// Get tags by classification tier
const coreTags = await getTagsByClassification("Core");
// Returns: ["Array", "String", "Hash Table", "Two Pointers"]

const advancedTags = await getTagsByClassification("Advanced");
// Returns: ["Dynamic Programming", "Graph", "Tree", "Backtracking"]

// Calculate tag similarity
const similarity = await calculateTagSimilarity("Array", "Hash Table");
// Returns: 0.68 (often used together)
```

### ⚙️ **limit.js** - Time & Attempt Limits

**Purpose**: Manages time limits and attempt constraints for problems

```javascript
// Get time limits for a problem
const limits = await getProblemLimits("two-sum");
// Returns: { timeLimit: 1200000, attempts: 3, difficulty: "Easy" }

// Update problem time constraints
await updateLimits("two-sum", {
  timeLimit: 900000, // 15 minutes
  attempts: 2
});

// Calculate personalized limits based on user level
const adaptiveLimits = await calculateAdaptiveLimits("Medium", 0.75);
// Returns personalized time limits based on 75% mastery level
```

### 🗄️ **backupDB.js & restoreDB.js** - Backup & Recovery

**Purpose**: Database backup and recovery operations for data safety

```javascript
// Create complete database backup
const backup = await createBackup();
// Returns: { version: 25, timestamp: ..., data: { problems: [...], sessions: [...] } }

// Restore database from backup
await restoreFromBackup(backupData);

// Verify backup integrity
const isValid = await validateBackup(backupData);

// Schedule automatic backups
await scheduleAutomaticBackup(); // Daily backups to Chrome storage
```

## Database Schema & Relationships

### Core Data Relationships

```
Sessions ↔ Attempts: sessions.id = attempts.sessionId
Problems ↔ Attempts: problems.leetCodeID = attempts.problemId
Tags ↔ Mastery: tag_relationships.id = tag_mastery.tag
Tags ↔ Ladders: tag_relationships.id = pattern_ladders.tag
Sessions ↔ Analytics: sessions.id = session_analytics.sessionId
```

### Index Strategy

- **Primary Keys**: Natural keys where possible (leetCodeID, tag), auto-increment for logs
- **Secondary Indexes**: Query-optimized indexes for common access patterns
- **Composite Indexes**: Multi-field indexes for complex queries

## Performance Optimization

### Query Patterns

```javascript
// Efficient indexed queries
const problems = await fetchAdditionalProblems({
  tags: ["Array"], // Uses tag index
  boxLevel: [2, 3], // Uses boxLevel index
  lastReviewed: { before: Date.now() - 86400000 } // Uses timestamp index
});

// Batch operations for performance
await Promise.all([
  updateProblemInDB("problem1", updates),
  updateProblemInDB("problem2", updates),
  updateProblemInDB("problem3", updates)
]);
```

### Memory Management

- **Proper Cleanup**: All cursors and transactions are properly closed
- **Connection Pooling**: Singleton pattern prevents connection bloat
- **Lazy Loading**: Large datasets loaded on demand
- **Transaction Batching**: Related operations grouped in single transactions

## Error Handling

### Comprehensive Error Management

```javascript
try {
  const result = await dbOperation();
  return result;
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Handle storage quota issues
    await cleanupOldData();
    return await fallbackOperation();
  }
  
  // Log and transform error for user consumption
  console.error('Database operation failed:', error);
  throw new Error(`Operation failed: ${error.message}`);
}
```

### Version Migration

```javascript
// Automatic schema upgrades
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  
  // Safe store creation with proper indexes
  if (!db.objectStoreNames.contains("newStore")) {
    const store = db.createObjectStore("newStore", { keyPath: "id" });
    store.createIndex("by_timestamp", "timestamp", { unique: false });
  }
  
  // Data migration for existing stores
  if (event.oldVersion < 25) {
    await migrateToVersion25(db);
  }
};
```

## Testing Strategy

Database operations are tested through:

- **Schema Integrity**: Version migration testing ensures no data loss
- **Data Consistency**: Relationship constraints validated
- **Performance**: Query optimization verified with large datasets
- **Error Scenarios**: Storage quota and corruption handling tested

## Best Practices

### Service Integration

```javascript
// ✅ Correct: Services access database through store utilities
export const ProblemService = {
  async createSession() {
    const problems = await fetchAllProblems({ criteria });
    return await saveNewSessionToDB({ problems });
  }
};

// ❌ Incorrect: Components should never access database directly
const Component = () => {
  // Never do this in components
  const problems = await fetchAllProblems();
};
```

### Transaction Management

```javascript
// Batch related operations in transactions
const transaction = db.transaction(['problems', 'attempts'], 'readwrite');
await Promise.all([
  updateProblemInDB(problemId, updates),
  recordAttempt(attemptData)
]);
```

### Error Recovery

```javascript
// Implement graceful degradation
try {
  return await getOptimalSessionProblems();
} catch (error) {
  console.warn('Advanced selection failed, using fallback:', error);
  return await getBasicSessionProblems();
}
```

## Store File Locations

All database utilities are located in `chrome-extension-app/src/shared/db/`:

**Core Stores:**
- `problems.js` - Problem data with Leitner system
- `sessions.js` - Session management and analytics
- `attempts.js` - Individual attempt tracking  
- `tag_mastery.js` - Algorithm pattern mastery
- `pattern_ladder.js` - Progressive difficulty ladders

**Supporting Stores:**
- `standard_problems.js` - Canonical LeetCode problem database
- `session_analytics.js` - Detailed performance analysis
- `problem_relationships.js` - Problem similarity graph
- `tag_relationships.js` - Algorithm tag classifications

**Infrastructure:**
- `index.js` - Central database helper and schema management
- `common.js` - Shared utilities and error handling
- `backupDB.js` / `restoreDB.js` - Backup and recovery operations

For implementation details and usage examples, refer to the individual store files and their integration within the service layer.