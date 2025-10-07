# CodeMaster Chrome Extension - Database Structure Overview

## Database Overview

**Database Name:** `CodeMaster`
**Current Version:** 22
**Database Type:** IndexedDB (Browser-native NoSQL)
**Total Object Stores:** 16
**Architecture:** Modular store-based with centralized database helper
**Schema Convention:** snake_case field naming for database consistency

## Release Notes

### Field Naming Standardization (Release Prep)
- **ALL database fields use snake_case naming** (e.g., `total_attempts`, `successful_attempts`, `last_practiced`)
- **Backward compatibility with camelCase removed** for release preparation
- **Code must use snake_case** when accessing database fields to prevent undefined property errors

## Core Architecture

### Database Helper (`dbHelper`)
- **Connection Management**: Singleton pattern with cached connections
- **Version Control**: Automatic migration system with backup safety
- **Error Handling**: Comprehensive retry logic and graceful degradation
- **Access Control**: Context-aware permissions and stack tracing
- **Performance**: Connection pooling and transaction batching

### Schema Evolution
The database uses versioned migrations starting from version 1, with major schema changes including:
- **v20**: Comprehensive store system implementation
- **v22**: Enhanced session analytics and snake_case field standardization

## Object Stores Detail

### 1. **attempts** (Core Learning Data)
**Purpose:** Individual problem attempt tracking with timing and success metrics

**Schema:**
```javascript
{
  id: "uuid-string",                    // Primary Key (UUID)
  problem_id: "uuid-string",           // FK to problems.problem_id
  leetcode_id: 123,                    // FK to standard_problems.id (numeric)
  session_id: "session-uuid",          // FK to sessions.id
  success: true/false,                 // Attempt outcome
  attempt_date: "2024-01-01T12:00:00Z", // ISO timestamp
  time_spent: 900,                     // Seconds spent on problem
  difficulty: 5,                       // User-assessed difficulty (1-10)
  comments: "solution notes...",       // User comments
  exceeded_recommended_time: false,    // Performance tracking (timer system)
  overage_time: 0,                     // Time over recommendation (timer system)
  user_intent: "completed",            // "completed", "stuck", "solving" (timer system)
  time_warning_level: 0,               // Performance warnings triggered (timer system)
  interviewSignals: {                  // Interview mode performance metrics (optional)
    transferAccuracy: 0.85,
    speedDelta: -200,
    hintPressure: 0.2,
    timeToFirstPlanMs: 45000,
    timeToFirstKeystroke: 120000,
    hintsUsed: 2,
    hintsRequestedTimes: [180, 420],
    approachChosen: "dynamic-programming",
    stallReasons: ["edge-case", "optimization"]
  }
}
```

**Indexes:**
- `by_attempt_date` - Temporal queries
- `by_problem_and_date` - Composite for problem history
- `by_problem_id` - Problem-specific lookups
- `by_session_id` - Session-based analytics
- `by_leetcode_id` - Cross-reference with standard problems
- `by_time_spent` - Performance analysis
- `by_success` - Success rate queries

**Key Design Notes:**
- **Timer Fields**: `exceeded_recommended_time`, `overage_time`, `user_intent`, `time_warning_level` are critical for Leitner algorithm performance scoring and progressive timer warnings
- **Clean Schema**: `box_level` and `next_review_date` are stored on problem records, not attempt records
- **Interview Integration**: Optional `interviewSignals` object provides specialized metrics for interview mode
- **Multi-source Tracking**: `source` field distinguishes session vs independent problem solving

### 2. **problems** (User Problem Progress)
**Purpose:** User's personalized problem tracking with Leitner box progression

**Schema:**
```javascript
{
  problem_id: "uuid-string",           // Primary Key (UUID)
  leetcode_id: 123,                    // FK to standard_problems.id
  title: "two sum",                    // Normalized lowercase title
  leetcode_address: "https://...",     // LeetCode problem URL
  cooldown_status: false,              // Spaced repetition cooldown
  box_level: 1,                        // Leitner system level (1-8)
  review_schedule: "2024-01-02T10:00:00Z", // Next review timestamp
  perceived_difficulty: 5,             // User difficulty rating
  consecutive_failures: 0,             // Failure tracking
  stability: 1.0,                      // FSRS stability metric
  attempt_stats: {                     // Aggregated statistics
    total_attempts: 5,
    successful_attempts: 3,
    unsuccessful_attempts: 2
  },
  // tags: Removed - sourced from session problems and standard_problems for maintainability
}
```

**Indexes:**
- `by_tags` (multiEntry) - Tag-based filtering
- `by_title` - Title searches
- `by_box_level` - Leitner box queries
- `by_review_schedule` - Spaced repetition
- `by_leetcode_id` - Cross-reference queries
- `by_cooldown_status` - Active/inactive problems

### 3. **sessions** (Learning Sessions)
**Purpose:** Learning session management with adaptive configuration

**Schema:**
```javascript
{
  id: "session-uuid",                  // Primary Key (UUID)
  session_type: "standard",            // "standard", "interview-like", "full-interview", "tracking"
  status: "completed",                 // "draft", "in_progress", "completed"
  problems: [                          // Session problems array
    {
      id: 1,                           // LeetCode problem number
      title: "Two Sum",
      difficulty: "Easy",
      tags: ["Array", "Hash Table"]
    }
  ],
  attempts: [                          // Session attempts references
    {
      attempt_id: "uuid",
      problem_id: 123,                 // LeetCode problem number
      success: true,
      time_spent: 900,
      source: "session_problem"
    }
  ],
  created_date: "2024-01-01T10:00:00Z", // Session creation time
  last_activity_time: "2024-01-01T11:30:00Z", // Last interaction
  current_problem_index: 2              // Current problem in session
}
```

**Indexes:**
- `by_date` - Temporal session queries
- `by_session_type` - Session type filtering
- `by_session_type_status` - Composite for active sessions
- `by_last_activity_time` - Stale session detection

### 4. **session_analytics** (Performance Analytics)
**Purpose:** Detailed session performance analysis and insights

**Schema:**
```javascript
{
  session_id: "session-uuid",          // Primary Key (FK to sessions.id)
  completed_at: "2024-01-01T12:00:00Z", // Session completion time
  accuracy: 0.75,                      // Success rate (0-1)
  avg_time: 1200,                      // Average time per problem (seconds)
  predominant_difficulty: "Medium",    // Most common difficulty
  total_problems: 4,                   // Problems attempted
  difficulty_mix: {                    // Difficulty distribution
    easy: 25,
    medium: 50,
    hard: 25
  },
  new_masteries: 1,                    // Tags newly mastered
  decayed_masteries: 0,                // Tags lost mastery
  mastery_deltas: [                    // Mastery changes
    { tag: "array", delta: 0.1 },
    { tag: "hash-table", delta: -0.05 }
  ],
  strong_tags: ["array", "string"],    // High-performance tags
  weak_tags: ["dynamic-programming"],  // Struggling tags
  timing_feedback: {                   // Timing performance
    easy: "onTarget",
    medium: "tooSlow",
    hard: "noData"
  },
  insights: {                          // Generated insights
    accuracy_trend: "improving",
    difficulty_readiness: "Medium",
    recommended_focus: ["dynamic-programming"]
  },
  difficulty_breakdown: {              // Detailed performance
    easy: { attempts: 1, correct: 1, time: 600, avg_time: 600 },
    medium: { attempts: 2, correct: 1, time: 2400, avg_time: 1200 },
    hard: { attempts: 1, correct: 0, time: 1800, avg_time: 1800 }
  }
}
```

**Indexes:**
- `by_date` - Temporal analytics
- `by_accuracy` - Performance filtering
- `by_difficulty` - Difficulty-based analysis

### 5. **standard_problems** (Canonical Problem Database)
**Purpose:** Master catalog of LeetCode problems with official metadata

**Schema:**
```javascript
{
  id: 1,                               // Primary Key (LeetCode problem number)
  title: "Two Sum",                    // Official problem title
  slug: "two-sum",                     // URL slug for LeetCode
  difficulty: "Easy",                  // Official difficulty level
  tags: ["Array", "Hash Table"]        // Algorithm/data structure tags
}
```

**Indexes:**
- `by_slug` - URL-based lookups

### 6. **tag_mastery** (Algorithm Pattern Mastery)
**Purpose:** User mastery tracking for algorithm patterns and techniques

**Schema:**
```javascript
{
  tag: "dynamic-programming",          // Primary Key (algorithm tag)
  total_attempts: 20,                  // Total attempts on this tag
  successful_attempts: 15,             // Successful attempts
  decay_score: 0.95,                   // Decay factor for spaced repetition
  mastered: true,                      // Mastery threshold reached
  strength: 0.75,                      // Calculated mastery strength (0-1)
  mastery_date: "2024-01-01T10:00:00Z", // Date mastery achieved (null if not mastered)
  last_practiced: "2024-01-15T10:00:00Z" // Most recent practice date
}
```

**Indexes:**
- `by_tag` - Tag-based queries

### 7. **pattern_ladders** (Progressive Difficulty Ladders)
**Purpose:** Structured problem progression for each algorithm pattern

**Schema:**
```javascript
{
  tag: "binary-search",                // Primary Key (algorithm tag)
  last_updated: "2025-09-16T18:08:02.742Z", // Last regeneration timestamp
  problems: [                          // Static reference problems
    {
      id: 704,
      title: "Binary Search",
      difficulty: "Easy",
      tags: ["Array", "Binary Search"]
    },
    {
      id: 74,
      title: "Search a 2D Matrix",
      difficulty: "Medium",
      tags: ["Array", "Binary Search", "Matrix"]
    }
  ]
}
```

**Indexes:**
- `by_tag` - Tag-based ladder queries

### 8. **tag_relationships** (Algorithm Tag Connections)
**Purpose:** Algorithm pattern classification and learning progression

**Schema:**
```javascript
{
  id: "array",                         // Primary Key (tag name)
  classification: "Core Concept",      // "Core Concept", "Fundamental Technique", "Advanced Technique"
  related_tags: [                      // Connected patterns as array
    { tag: "hash-table", strength: 0.8 },
    { tag: "two-pointers", strength: 0.6 }
  ],
  difficulty_distribution: {           // Problems by difficulty
    easy: 371,
    medium: 968,
    hard: 448
  },
  learning_order: 1,                   // Recommended learning sequence
  prerequisite_tags: [],               // Empty - using tier-based progression instead of hard prerequisites
  mastery_threshold: 0.75              // Dynamic: 0.75 (Core), 0.80 (Fundamental), 0.85 (Advanced) ± 0.05
}
```

**Mastery Threshold Calculation:**
- Core Concepts: 75% base threshold (fundamental building blocks)
- Fundamental Techniques: 80% base threshold (essential algorithms)
- Advanced Techniques: 85% base threshold (complex patterns)
- Hard-heavy tags (>60% hard problems): -5% adjustment for difficulty

**Design Notes:**
- `prerequisite_tags` intentionally kept empty - using flexible tier-based progression
- `related_tags.strength` values provide soft dependencies through similarity
- Classification-based thresholds balance learning goals with realistic expectations

**Indexes:**
- `by_classification` - Tier-based queries

### 9. **problem_relationships** (Dynamic Problem Similarity Graph)
**Purpose:** Dynamic problem similarity and recommendation network based on user solving patterns

**Architecture:** Dynamic relationships built from:
- **Session sequences**: Problems solved consecutively with success
- **Tag similarity**: Shared algorithm patterns from session problems
- **Difficulty progression**: Appropriate stepping stones between difficulty levels
- **User performance**: Success patterns and learning paths

**Schema:**
```javascript
{
  id: 1,                               // Primary Key (auto-increment)
  problem_id1: 123,                    // First problem LeetCode ID
  problem_id2: 456,                    // Second problem LeetCode ID
  strength: 0.85,                      // Relationship strength (0-1)
  relationship_type: "session_sequence", // "session_sequence", "tag_similarity", "difficulty_progression"
  shared_tags: ["array", "hash-table"], // Common algorithm tags (from session data)
  difficulty_delta: 0,                 // Difficulty difference (-2 to 2)
  created_at: "2024-01-01T10:00:00Z",  // Relationship creation time
  updated_at: "2024-01-15T10:00:00Z",  // Last strength update
  user_success_rate: 0.8               // Success rate for this relationship path
}
```

**Key Design Notes:**
- **Dynamic Building**: Relationships are built from actual user session sequences, not static `NextProblem` fields
- **Tag Data Source**: Tag information comes from session problems (which have complete tag data)
- **Adaptive Strength**: Relationship strength updates based on user success patterns
- **Performance Integration**: Works with tag mastery system for intelligent problem selection

**Indexes:**
- `by_problem_id1` - First problem relationships
- `by_problem_id2` - Reverse relationship lookups
- `by_relationship_type` - Relationship type filtering
- `by_updated_at` - Recent relationship updates

### 10. **strategy_data** (Algorithm Strategy Guide)
**Purpose:** Algorithm pattern strategies, templates, and guidance

**Schema:**
```javascript
{
  tag: "sliding-window",               // Primary Key (algorithm pattern)
  patterns: [                          // Problem patterns
    "fixed-size-window",
    "variable-size-window",
    "two-pointers-approach"
  ],
  templates: {                         // Code templates
    python: "def sliding_window(arr):\n    left = 0\n    ...",
    javascript: "function slidingWindow(arr) {\n    let left = 0;\n    ..."
  },
  key_insights: [                      // Strategy insights
    "Maintain window invariant",
    "Optimize with two pointers",
    "Consider edge cases"
  ],
  related: ["two-pointers", "array"],  // Related patterns
  difficulty_level: "intermediate",    // Strategy complexity
  time_complexity: "O(n)",             // Typical time complexity
  space_complexity: "O(1)"             // Typical space complexity
}
```

**Indexes:**
- `by_tag` - Pattern-based queries
- `by_patterns` (multiEntry) - Pattern matching
- `by_related` (multiEntry) - Related pattern queries

### 11. **hint_interactions** (User Hint Analytics)
**Purpose:** Hint system usage analytics and optimization

**Schema:**
```javascript
{
  id: 1,                               // Primary Key (auto-increment)
  problem_id: "uuid-string",           // FK to problems.problem_id
  session_id: "session-uuid",          // FK to sessions.id
  leetcode_id: 123,                    // Problem LeetCode ID
  hint_type: "contextual",             // "contextual", "general", "primer"
  user_action: "viewed",               // "viewed", "dismissed", "applied"
  timestamp: "2024-01-01T10:30:00Z",   // Interaction timestamp
  problem_difficulty: "Medium",        // Problem difficulty at time
  box_level: 2,                        // User's box level for problem
  time_before_hint: 300,               // Seconds before requesting hint
  hint_effectiveness: null,            // Post-hint success (set later)
  user_rating: null                    // User feedback on hint quality
}
```

**Indexes:**
- `by_problem_id` - Problem-specific analytics
- `by_session_id` - Session hint usage
- `by_timestamp` - Temporal analysis
- `by_hint_type` - Hint type effectiveness
- `by_user_action` - Action pattern analysis
- `by_difficulty` - Difficulty-based usage
- `by_box_level` - Progression-based patterns
- `by_problem_and_action` - Composite analytics
- `by_hint_type_and_difficulty` - Cross-dimensional analysis

### 12. **user_actions** (User Behavior Analytics)
**Purpose:** User interaction tracking for UX optimization

**Schema:**
```javascript
{
  id: 1,                               // Primary Key (auto-increment)
  timestamp: "2024-01-01T10:00:00Z",   // Action timestamp
  category: "navigation",              // Action category
  action: "page_view",                 // Specific action
  session_id: "session-uuid",          // Associated session
  url: "chrome-extension://...",       // Page URL
  user_agent: "Chrome/120.0...",       // Browser info
  additional_data: {                   // Context-specific data
    page_title: "Problem Generator",
    referrer: "dashboard",
    duration: 45
  }
}
```

**Indexes:**
- `by_timestamp` - Temporal analysis
- `by_category` - Category-based filtering
- `by_action` - Action-specific queries
- `by_session` - Session-based tracking
- `by_url` - Page-specific analytics
- `by_user_agent` - Browser/device analysis

### 13. **error_reports** (Error Tracking)
**Purpose:** Application error monitoring and debugging

**Schema:**
```javascript
{
  id: 1,                               // Primary Key (auto-increment)
  timestamp: "2024-01-01T10:00:00Z",   // Error timestamp
  section: "problem_generator",        // Application section
  error_type: "TypeError",             // Error classification
  error_message: "Cannot read property...", // Error description
  stack_trace: "at Function...",       // Full stack trace
  user_agent: "Chrome/120.0...",       // Browser information
  url: "chrome-extension://...",       // Error location
  user_actions_before_error: [...],    // Recent user actions
  session_context: {                   // Session state
    active_session: "uuid",
    current_problem: 123
  }
}
```

**Indexes:**
- `by_timestamp` - Temporal error analysis
- `by_section` - Section-based filtering
- `by_error_type` - Error classification
- `by_user_agent` - Browser-specific issues

### 14. **limits** (Time Constraints)
**Purpose:** Problem time limit management and adaptive constraints

**Schema:**
```javascript
{
  id: 1,                               // Primary Key (auto-increment)
  problem_id: "uuid-string",           // FK to problems.problem_id
  difficulty: "Medium",                // Problem difficulty
  recommended_time: 1200,              // Recommended time (seconds)
  maximum_time: 1800,                  // Maximum allowed time
  user_personalization: {              // User-specific adjustments
    user_multiplier: 1.2,
    performance_based: true
  },
  create_at: "2024-01-01T10:00:00Z"   // Limit creation time
}
```

**Indexes:**
- `by_create_at` - Temporal queries

### 15. **session_state** (User Session State)
**Purpose:** User progression state and adaptive learning parameters

**Schema:**
```javascript
{
  id: "session_state",                 // Primary Key (singleton)
  num_sessions_completed: 15,          // Completed sessions count
  current_difficulty_cap: "Medium",    // Current difficulty ceiling
  tag_index: 2,                        // Current tag progression index
  difficulty_time_stats: {             // Performance by difficulty
    Easy: { problems: 20, total_time: 12000, avg_time: 600 },
    Medium: { problems: 15, total_time: 22500, avg_time: 1500 },
    Hard: { problems: 5, total_time: 12000, avg_time: 2400 }
  },
  last_performance: {                  // Recent performance metrics
    accuracy: 0.8,
    efficiency_score: 0.7
  },
  escape_hatches: {                    // Progression assistance
    sessions_at_current_difficulty: 3,
    last_difficulty_promotion: "2024-01-01T10:00:00Z",
    sessions_without_promotion: 5,
    activated_escape_hatches: ["session-based"]
  }
}
```

### 16. **backup_storage** (Database Backups)
**Purpose:** Database backup storage and recovery management

**Schema:**
```javascript
{
  backup_id: "backup-uuid-timestamp",  // Primary Key
  created_at: "2024-01-01T10:00:00Z",  // Backup creation time
  backup_type: "migration",            // "manual", "automatic", "migration"
  data_snapshot: {                     // Compressed backup data
    version: 47,
    stores: { /* serialized store data */ }
  },
  metadata: {                          // Backup metadata
    size_bytes: 1048576,
    compression: "gzip",
    checksum: "abc123..."
  }
}
```

**Indexes:**
- `by_backup_id` - Backup identification

### 17. **settings** (User Preferences)
**Purpose:** User configuration and preferences storage

**Schema:**
```javascript
{
  id: "user_settings",                 // Primary Key (singleton)
  session_length: 4,                   // Preferred session length
  number_of_new_problems_per_session: 2, // New problems per session
  max_difficulty: "Hard",              // Maximum difficulty preference
  focus_areas: ["array", "hash-table"], // User-selected focus tags
  notification_preferences: {          // Notification settings
    daily_reminder: true,
    achievement_alerts: false,
    performance_insights: true
  },
  theme_preferences: {                 // UI customization
    dark_mode: false,
    accent_color: "#007bff"
  },
  privacy_settings: {                  // Privacy configuration
    analytics_enabled: true,
    error_reporting: true
  }
}
```

## Data Architecture Layers

### **Tag Relationships vs Problem Relationships**

The system uses a **two-layer relationship architecture** for intelligent problem selection:

#### **Layer 1: Tag Relationships (Static/Conceptual)**
- **Purpose**: Represent unchanging conceptual connections between algorithm patterns
- **Examples**: "Array" ↔ "Two Pointers", "Tree" ↔ "DFS", "Hash Table" ↔ "String"
- **Nature**: Domain knowledge - consistent across all users
- **Storage**: `tag_relationships` store with fixed conceptual strengths
- **Usage**: Bridge topics when user masters a tag, determine focus areas

#### **Layer 2: Problem Relationships (Dynamic/Behavioral)**
- **Purpose**: Capture personalized learning paths based on actual user solving patterns
- **Examples**: "Two Sum" → "Valid Anagram" (user solved consecutively with success)
- **Nature**: Adaptive - reflects each user's unique learning journey
- **Storage**: `problem_relationships` store with dynamic strength updates
- **Usage**: Fine-tune problem selection within tags, create personalized progression paths

#### **Integration Strategy**
1. **Tag mastery** determines *what topics* user should focus on (primary selection)
2. **Tag relationships** suggest *related topics* when mastery transitions occur
3. **Problem relationships** determine *which specific problems* within those topics (fine-tuning)
4. **Pattern ladders** combine both layers to create progressive difficulty paths

This architecture prevents "scope creep" where a tag like "Array" (appearing on hundreds of problems) becomes too broad - problem relationships help narrow down to the most appropriate problems based on the user's actual success patterns.

## Data Relationships and Flow

### Primary Relationships
```
sessions (1) ←→ (N) attempts
problems (1) ←→ (N) attempts
standard_problems (1) ←→ (N) problems
sessions (1) ←→ (1) session_analytics
tag_relationships (1) ←→ (1) tag_mastery
tag_relationships (1) ←→ (1) pattern_ladders
problems (N) ←→ (N) problem_relationships
```

### Key Foreign Key Relationships
- `attempts.problem_id` → `problems.problem_id` (UUID-based)
- `attempts.leetcode_id` → `standard_problems.id` (numeric LeetCode ID)
- `attempts.session_id` → `sessions.id` (session association)
- `problems.leetcode_id` → `standard_problems.id` (canonical reference)
- `session_analytics.session_id` → `sessions.id` (analytics linkage)
- `tag_mastery.tag` → `tag_relationships.id` (mastery tracking)
- `pattern_ladders.tag` → `tag_relationships.id` (progression tracking)

### Data Flow Patterns

1. **Problem Attempt Flow:**
   ```
   User attempts problem → attempts record created → problems stats updated → session progress tracked → analytics computed
   ```

2. **Session Completion Flow:**
   ```
   Session started → problems selected → attempts recorded → session completed → analytics stored → mastery updated
   ```

3. **Adaptive Learning Flow:**
   ```
   Performance analyzed → difficulty adjusted → focus tags updated → next session configured → problem selection optimized
   ```

## Key Features and Capabilities

### 1. **Spaced Repetition System**
- Leitner box algorithm implementation in `problems` store
- Dynamic review scheduling based on performance
- Stability tracking using FSRS (Free Spaced Repetition Scheduler)

### 2. **Adaptive Learning Engine**
- Performance-based difficulty progression
- Dynamic session length adjustment
- Focus area optimization based on weak tags

### 3. **Comprehensive Analytics**
- Session-level performance tracking
- Tag mastery progression
- Temporal performance analysis
- User behavior insights

### 4. **Progressive Problem Sequencing**
- Algorithm pattern-based ladders
- Difficulty curve optimization
- Related problem recommendations

### 5. **Robust Data Management**
- Versioned schema migrations
- Automatic backup and recovery
- Data integrity validation
- Performance optimization

## Migration History and Version Changes

### Recent Major Versions
- **v47 (Current)**: Dynamic problem relationships and tag mastery integration
  - Removed `tags` field from `problems` store (sourced from sessions for maintainability)
  - Updated problem relationships to use session sequences instead of static `NextProblem` fields
  - Enhanced tag mastery updates to use session problem data with complete tag information
  - Improved relationship building with tag similarity integration
- **v22**: Snake_case standardization and session analytics enhancement
- **v20**: Comprehensive store system implementation
- **v19**: Enhanced indexes for performance optimization
- **v18**: Strategy data store introduction
- **v17**: Hint interactions analytics implementation
- **v16**: Problem relationships system introduction

### Migration Safety
- Automatic backup creation before schema changes
- Data preservation during store recreation
- Rollback capability via backup restoration
- Version validation and integrity checks

## Performance Characteristics

### Query Optimization
- Strategic indexing for common access patterns
- Composite indexes for multi-field queries
- Cursor-based iteration for large datasets
- Transaction batching for bulk operations

### Storage Efficiency
- Normalized data structure to minimize redundancy
- Compressed backup storage
- Lazy loading for large datasets
- Efficient index utilization

### Reliability Features
- Connection pooling and retry logic
- Graceful degradation for quota issues
- Comprehensive error handling
- Data integrity validation

## Development and Maintenance

### Schema Evolution Strategy
1. Version increment for schema changes
2. Migration function implementation
3. Backup creation before changes
4. Data preservation and validation
5. Rollback capability maintenance

### Testing Approach
- Schema migration testing
- Data integrity validation
- Performance benchmarking
- Error scenario coverage
- Cross-browser compatibility

### Monitoring and Debugging
- Comprehensive error logging
- Performance metrics tracking
- User behavior analytics
- Database health monitoring

This database structure represents a sophisticated learning management system optimized for personalized algorithm practice, spaced repetition, and adaptive difficulty progression within the constraints of a browser extension environment.