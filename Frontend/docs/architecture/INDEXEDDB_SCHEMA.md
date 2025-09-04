# 📊 IndexedDB Database Schema

## Database Info

- **Database Name**: "review"
- **Current Version**: 36 (as of 2025-09-04)
- **Total Stores**: 17 specialized object stores
- **Access Pattern**: Service layer only (components never access directly)
- **New Features**: Retry-enabled operations, Circuit Breaker patterns, Session conflict resolution

---

## 🗃️ Store Definitions & Object Structures

### 1. `attempts` Store

**Purpose**: Track individual problem attempts with performance data  
**Key**: `id` (auto-increment)  
**Indexes**: `by_date`, `by_problem_and_date`, `by_problemId`, `by_sessionId`

**Object Structure**:

```javascript
{
  id: 123,                          // Auto-increment primary key
  sessionId: "session-uuid-123",    // Associated session ID
  problemId: "problem-456",         // Problem identifier
  success: true,                    // Whether attempt was successful
  attemptDate: "2024-01-15",        // Date of attempt
  timeSpent: 1200,                  // Time in seconds
  difficulty: "Medium",             // Problem difficulty
  comments: "Struggled with optimization" // Optional user notes
}
```

---

### 2. `limits` Store

**Purpose**: Store time/attempt limits for problems  
**Key**: `id` (auto-increment)  
**Indexes**: `by_createAt`

**Object Structure**:

```javascript
{
  id: 1,
  createAt: "2024-01-15T10:30:00Z",
  timeLimit: 1800,        // Time limit in seconds
  problemId: "two-sum",
  difficulty: "Easy"
}
```

---

### 3. `session_state` Store

**Purpose**: Track current session state and navigation  
**Key**: `id`

**Object Structure**:

```javascript
{
  id: "current_session",
  currentProblemIndex: 2,
  sessionId: "session-uuid-123",
  navigationState: "in_progress",
  lastUpdated: "2024-01-15T10:30:00Z"
}
```

---

### 4. `problem_relationships` Store

**Purpose**: Store relationships between problems for recommendation engine  
**Key**: Auto-generated  
**Indexes**: `by_problemId1`, `by_problemId2`

**Object Structure**:

```javascript
{
  problemId1: "problem-123",
  problemId2: "problem-456",
  relationshipStrength: 0.75,
  sharedTags: ["array", "hash-table"],
  difficulty: "similar",
  lastUpdated: "2024-01-15"
}
```

---

### 5. `problems` Store

**Purpose**: Store individual problems with Leitner system metadata  
**Key**: `leetCodeID`  
**Indexes**: `by_tag`, `by_problem`, `by_review`, `by_ProblemDescription`, `by_nextProblem`

**Object Structure**:

```javascript
{
  leetCodeID: "two-sum",
  problem: "Two Sum",
  ProblemDescription: "Given an array of integers...",
  tag: ["array", "hash-table"],
  difficulty: "Easy",
  review: "2024-01-20",           // Next review date
  nextProblem: "2024-01-25",      // Spaced repetition schedule

  // Leitner System Fields
  box: 1,                         // Current Leitner box level (0-6)
  stability: 2.5,                 // FSRS stability score
  difficulty: 0.3,                // FSRS difficulty score
  lastAttempt: "2024-01-15",      // Last attempt date
  successRate: 0.75,              // Historical success rate
  retrievability: 0.85,           // Current retrievability score

  // Metadata
  slug: "two-sum",
  companies: ["Google", "Amazon"],
  frequency: 4.5,
  premiumOnly: false
}
```

---

### 6. `sessions` Store

**Purpose**: Track learning sessions with problems and performance  
**Key**: `id` (manual assignment)  
**Indexes**: `by_date`

**Object Structure**:

```javascript
{
  id: "session-uuid-123",
  Date: "2024-01-15T10:00:00Z",
  problems: [
    {
      problemId: "two-sum",
      attempts: 2,
      success: true,
      timeSpent: 900,
      reasoning: "Tag weakness: array fundamentals"
    }
  ],
  totalTime: 1800,
  accuracy: 0.85,
  completed: true,
  sessionType: "adaptive",          // adaptive, review, focused
  targetTags: ["array", "hash-table"],
  adaptiveSettings: {
    sessionLength: 8,
    difficultyRange: ["Easy", "Medium"]
  }
}
```

---

### 7. `standard_problems` Store

**Purpose**: Store canonical problem data from LeetCode  
**Key**: `id` (auto-increment)  
**Indexes**: `by_slug`

**Object Structure**:

```javascript
{
  id: 1,
  slug: "two-sum",
  Title: "Two Sum",
  Difficulty: "Easy",
  Tags: ["Array", "Hash Table"],
  Description: "Given an array of integers...",
  Companies: ["Google", "Amazon"],
  Frequency: 4.5,
  AcceptanceRate: 0.47,
  LeetCodeUrl: "https://leetcode.com/problems/two-sum/",
  premiumOnly: false
}
```

---

### 8. `backup_storage` Store

**Purpose**: Store database backups for recovery  
**Key**: `backupId`  
**Indexes**: `by_backupId`

**Object Structure**:

```javascript
{
  backupId: "backup-2024-01-15",
  id: "backup-2024-01-15",
  timestamp: "2024-01-15T10:00:00Z",
  version: 25,
  data: {
    // Complete database backup data
    stores: {
      problems: { data: [...], count: 150 },
      attempts: { data: [...], count: 500 },
      sessions: { data: [...], count: 25 }
    }
  },
  size: "2.5MB",
  type: "automatic"
}
```

---

### 9. `tag_relationships` Store

**Purpose**: Store tag classifications and relationships for learning progression  
**Key**: `id` (tag name)  
**Indexes**: `by_classification`

**Object Structure**:

```javascript
{
  id: "array",
  classification: "Core Concept",     // Tiers: Core Concept, Fundamental Technique, Advanced Technique
  tier: 1,                            // Numeric tier for progression
  relatedTags: {
    "hash-table": 15,                 // Relationship strength scores
    "two-pointers": 8,
    "sorting": 12
  },
  description: "Fundamental data structure for storing collections",
  prerequisites: [],                   // Required tags before this one
  dependents: ["hash-table", "stack", "queue"]
}
```

---

### 10. `tag_mastery` Store

**Purpose**: Track user mastery progress for each algorithm pattern  
**Key**: `tag`  
**Indexes**: `by_tag`

**Object Structure**:

```javascript
{
  tag: "array",
  strength: 0.75,                     // Current mastery strength (0-1)
  decayScore: 0.85,                   // Decay factor for spaced repetition
  mastered: false,                    // Whether tag is considered mastered

  // Pattern Ladder Progress
  coreLadder: [
    { problemId: "two-sum", completed: true, attempts: 3 },
    { problemId: "best-time-buy-sell", completed: true, attempts: 2 }
  ],

  // Performance Metrics
  totalAttempts: 25,                  // Total problems attempted with this tag
  successfulAttempts: 20,             // Successful attempts
  averageTime: 720,                   // Average time per problem (seconds)
  lastAttempt: "2024-01-15",          // Last attempt date

  // FSRS Integration
  stability: 3.2,                     // FSRS stability for this tag
  difficulty: 0.4,                    // FSRS difficulty for this tag
  retrievability: 0.88,               // Current retrievability

  // Progression Tracking
  boxLevel: 2,                        // Current Leitner box level
  nextReview: "2024-01-20",           // Next review date
  promotionReadiness: 0.85            // Readiness for next level (0-1)
}
```

---

### 11. `settings` Store

**Purpose**: Store user preferences and configuration  
**Key**: `id`

**Object Structure**:

```javascript
{
  id: "user_preferences",
  theme: "dark",                      // light, dark, auto
  adaptiveMode: true,                 // Enable adaptive sessions
  sessionLength: 8,                   // Default session length
  maxDifficulty: "Medium",            // Easy, Medium, Hard
  reminderEnabled: true,
  reminderTime: "09:00",
  showHints: true,
  showReasoningPrimer: true,
  autoStartTimer: false,
  soundEnabled: true,
  language: "en"
}
```

---

### 12. `pattern_ladders` Store

**Purpose**: Store learning progression ladders for each algorithm pattern  
**Key**: `tag`  
**Indexes**: `by_tag`

**Object Structure**:

```javascript
{
  tag: "dynamic-programming",
  currentLevel: 2,                    // Current progression level
  completionRate: 0.6,                // Overall completion rate

  ladder: [
    {
      level: 1,
      problemId: "climbing-stairs",
      difficulty: "Easy",
      mastered: true,
      attempts: 3,
      bestTime: 300,
      lastAttempt: "2024-01-10"
    },
    {
      level: 2,
      problemId: "house-robber",
      difficulty: "Medium",
      mastered: false,
      attempts: 1,
      bestTime: 1200,
      lastAttempt: "2024-01-12"
    }
  ],

  // Progression Metadata
  prerequisiteTags: ["array", "recursion"],
  nextUnlockTags: ["memoization"],
  estimatedTimeToMastery: "2-3 weeks",
  difficultyProgression: ["Easy", "Medium", "Medium", "Hard"]
}
```

---

### 13. `session_analytics` Store

**Purpose**: Store detailed analytics for completed sessions  
**Key**: `sessionId`  
**Indexes**: `by_date`, `by_accuracy`, `by_difficulty`

**Object Structure**:

```javascript
{
  sessionId: "session-uuid-123",
  completedAt: "2024-01-15T11:30:00Z",

  // Performance Metrics
  accuracy: 0.85,                     // Session accuracy rate
  avgTime: 720,                       // Average time per problem
  totalTime: 1800,                    // Total session time

  // Difficulty Analysis
  predominantDifficulty: "Medium",
  totalProblems: 8,
  difficultyMix: {
    Easy: 0.25,
    Medium: 0.625,
    Hard: 0.125
  },

  // Mastery Progression
  newMasteries: ["two-pointers"],     // Tags newly mastered
  decayedMasteries: [],               // Tags that decayed
  masteryDeltas: {                    // Strength changes per tag
    "array": 0.05,
    "hash-table": -0.02
  },

  // Tag Performance Analysis
  strongTags: ["array", "string"],    // Best performing tags
  weakTags: ["graph", "dynamic-programming"], // Struggling tags
  improvementTags: ["sorting"],       // Tags showing improvement

  // Session Quality Metrics
  focusScore: 0.9,                    // Consistency of performance
  learningEfficiency: 0.75,          // Learning per unit time
  retentionPrediction: 0.85,          // Predicted retention

  // AI-Generated Insights
  insights: [
    "Strong performance on array problems - consider advancing difficulty",
    "Graph algorithms need focused practice",
    "Timing improved 15% from last session"
  ],
  recommendations: [
    "Practice BFS/DFS fundamentals",
    "Review tree traversal patterns"
  ],

  // Detailed Performance Breakdown
  difficultyBreakdown: {
    Easy: { attempted: 2, successful: 2, avgTime: 300 },
    Medium: { attempted: 5, successful: 4, avgTime: 800 },
    Hard: { attempted: 1, successful: 0, avgTime: 1200 }
  },

  // Strategy Map Integration
  hintsUsed: 3,                       // Number of hints accessed
  primersViewed: ["array-fundamentals"], // Educational content viewed
  strategicGuidanceEffectiveness: 0.8  // How helpful guidance was
}
```

---

### 14. `strategy_data` Store

**Purpose**: Store algorithm strategy content and educational hints  
**Key**: `id` (tag-based)  
**Indexes**: `by_tag`

**Object Structure**:

```javascript
{
  id: "array-fundamentals",
  tag: "array",
  category: "Core Concept",
  
  hints: [
    "Consider using two pointers for sorted arrays",
    "Hash maps can reduce time complexity from O(n²) to O(n)",
    "Think about edge cases: empty array, single element"
  ],
  
  primers: [
    {
      title: "Array Fundamentals",
      content: "Arrays are contiguous memory structures...",
      examples: ["Two Sum", "Best Time to Buy and Sell Stock"],
      timeComplexity: "Access: O(1), Search: O(n)"
    }
  ],
  
  patterns: [
    "Two Pointers",
    "Sliding Window", 
    "Prefix Sum"
  ],
  
  commonMistakes: [
    "Off-by-one errors in indexing",
    "Not handling empty input",
    "Forgetting to check array bounds"
  ],
  
  relatedConcepts: ["hash-table", "sorting", "binary-search"]
}
```

---

### 15. `hint_interactions` Store

**Purpose**: Track user interactions with hints and strategy guidance  
**Key**: `id` (auto-increment)  
**Indexes**: `by_sessionId`, `by_problemId`, `by_timestamp`

**Object Structure**:

```javascript
{
  id: 123,
  sessionId: "session-uuid-123",
  problemId: "two-sum",
  hintType: "contextual",              // contextual, strategic, primer
  hintContent: "Consider using a hash map",
  
  interaction: {
    viewed: true,
    timestamp: "2024-01-15T10:30:00Z",
    timeSpent: 45,                     // Seconds spent viewing hint
    helpful: true,                     // User feedback
    helpfulnessRating: 4               // 1-5 scale
  },
  
  context: {
    attemptNumber: 2,                  // Which attempt this hint was shown
    timeIntoAttempt: 300,              // Seconds into current attempt
    previousHintsViewed: 1,            // Number of previous hints in this attempt
    userStruggleIndicators: ["time_exceeded", "multiple_attempts"]
  },
  
  outcome: {
    problemSolved: true,
    solvedAfterHint: true,
    timeToSolution: 120,               // Seconds from hint to solution
    solutionQuality: "optimal"         // optimal, suboptimal, incomplete
  }
}
```

---

### 16. `user_actions` Store

**Purpose**: Track detailed user actions for analytics and behavior analysis  
**Key**: `id` (auto-increment)  
**Indexes**: `by_timestamp`, `by_actionType`, `by_sessionId`

**Object Structure**:

```javascript
{
  id: 456,
  timestamp: "2024-01-15T10:30:00Z",
  sessionId: "session-uuid-123",
  
  actionType: "problem_start",         // problem_start, hint_request, solution_submit, etc.
  actionData: {
    problemId: "two-sum",
    difficulty: "Easy",
    tags: ["array", "hash-table"],
    context: "adaptive_session"
  },
  
  userState: {
    currentStreak: 3,                  // Current success streak
    sessionProgress: 0.5,              // Progress through current session
    energyLevel: "high",               // high, medium, low (inferred)
    focusScore: 0.85                   // Concentration metric
  },
  
  performance: {
    responseTime: 150,                 // Time to take action (ms)
    accuracy: 1.0,                     // If applicable
    efficiency: 0.9                    // Action efficiency metric
  }
}
```

---

### 17. `error_reports` Store

**Purpose**: Store error reports and debugging information for system reliability  
**Key**: `id` (auto-increment)  
**Indexes**: `by_timestamp`, `by_errorType`, `by_severity`

**Object Structure**:

```javascript
{
  id: 789,
  timestamp: "2024-01-15T10:30:00Z",
  errorType: "database_operation_failed",
  severity: "medium",                  // low, medium, high, critical
  
  error: {
    message: "Failed to update tag mastery",
    stack: "Error at updateTagMastery:45...",
    code: "DB_WRITE_TIMEOUT",
    context: "session_completion"
  },
  
  systemState: {
    userAgent: "Chrome/120.0.0.0",
    extensionVersion: "0.9.5",
    databaseVersion: 36,
    memoryUsage: "45MB",
    activeStores: 17
  },
  
  userContext: {
    sessionId: "session-uuid-123",
    problemId: "two-sum",
    actionSequence: ["start_session", "solve_problem", "complete_session"],
    lastSuccessfulAction: "solve_problem"
  },
  
  recovery: {
    attempted: true,
    successful: false,
    fallbackUsed: "memory_cache",
    retryCount: 3,
    finalState: "partial_failure"
  },
  
  resolved: false,
  resolution: {
    method: "automatic_retry",
    timestamp: "2024-01-15T10:32:00Z",
    notes: "Resolved after database connection reset"
  }
}
```

---

## 🔗 Key Relationships

### Primary Relationships

- `Sessions ↔ Attempts`: `sessions.id = attempts.sessionId`
- `Problems ↔ Attempts`: `problems.leetCodeID = attempts.problemId`
- `Tags ↔ Mastery`: `tag_relationships.id = tag_mastery.tag`
- `Tags ↔ Ladders`: `tag_relationships.id = pattern_ladders.tag`
- `Sessions ↔ Analytics`: `sessions.id = session_analytics.sessionId`

### Data Flow Dependencies

- **Session Creation**: `tag_mastery` → `pattern_ladders` → `problems` → `sessions`
- **Attempt Recording**: `attempts` → `sessions` → `tag_mastery` → `session_analytics`
- **Mastery Calculation**: `attempts` → `tag_mastery` → `pattern_ladders`
- **Review Scheduling**: `tag_mastery` → `problems` (FSRS algorithm)

---

## 📈 Schema Evolution

### Version History

- **v22-25**: Initial schema with basic stores and strategy system
- **v26-30**: Enhanced session analytics and FSRS integration  
- **v31-35**: Added retry mechanisms, Circuit Breaker patterns, and advanced hint tracking
- **v36**: Current version with session conflict resolution and comprehensive error reporting

### Migration Support

- Automatic schema upgrades via `src/shared/db/index.js`
- Backward compatibility maintained
- Data preservation during version upgrades
- Comprehensive error handling and recovery

---

This IndexedDB structure supports a comprehensive learning management system with spaced repetition, mastery tracking, session analytics, and adaptive learning algorithms while maintaining clean separation between UI components and data access through the service layer.
