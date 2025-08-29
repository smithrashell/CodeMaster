 📊 Complete IndexedDB Store Summary

  Database Info:

  - Database Name: "review"
  - Current Version: 24
  - Total Stores: 11

  ---
  🗃️ Store Definitions & Object Structures:

  1. attempts Store

  Purpose: Track individual problem attempts with performance data
  Key: id (auto-increment)
  Indexes: by_date, by_problem_and_date, by_problemId, by_sessionId

  Object Structure:
  {
    id: 123,                          // Auto-increment primary key
    SessionID: "session-uuid-123",    // Associated session ID
    ProblemID: "problem-456",         // Problem identifier
    Success: true,                    // Whether attempt was successful
    AttemptDate: "2024-01-15",        // Date of attempt
    TimeSpent: 1200,                  // Time in seconds
    Difficulty: "Medium",             // Problem difficulty
    Comments: "Struggled with optimization" // Optional user notes
  }

  ---
  2. limits Store

  Purpose: Store time/attempt limits for problems
  Key: id (auto-increment)
  Indexes: by_createAt

  Object Structure:
  {
    id: 1,
    createAt: "2024-01-15T10:30:00Z",
    // Additional limit-related fields
  }

  ---
  3. session_state Store

  Purpose: Track current session state and navigation
  Key: id

  Object Structure:
  {
    id: "current_session",
    // Session state fields
  }

  ---
  4. problem_relationships Store

  Purpose: Store relationships between problems for recommendation engine
  Key: Auto-generated
  Indexes: by_problemId1, by_problemId2

  Object Structure:
  {
    problemId1: "problem-123",
    problemId2: "problem-456",
    relationshipStrength: 0.75,
    // Additional relationship metrics
  }

  ---
  5. problems Store

  Purpose: Store individual problems with metadata and tracking info
  Key: leetCodeID
  Indexes: by_tag, by_problem, by_review, by_ProblemDescription, by_nextProblem      

  Object Structure:
  {
    leetCodeID: "two-sum",
    problem: "Two Sum",
    ProblemDescription: "Given an array...",
    tag: ["array", "hash-table"],
    Difficulty: "Easy",
    review: "2024-01-20",
    nextProblem: "2024-01-25",
    // Leitner system fields
    box: 1,
    stability: 2.5,
    lastAttempt: "2024-01-15",
    successRate: 0.75
  }

  ---
  6. sessions Store

  Purpose: Track learning sessions with problems and performance
  Key: id (manual assignment)
  Indexes: by_date

  Object Structure:
  {
    id: "session-uuid-123",
    Date: "2024-01-15T10:00:00Z",
    problems: [
      {
        problemId: "two-sum",
        attempts: 2,
        success: true,
        timeSpent: 900
      }
    ],
    totalTime: 1800,
    accuracy: 0.85,
    completed: true
  }

  ---
  7. standard_problems Store

  Purpose: Store canonical problem data from LeetCode
  Key: id (auto-increment)
  Indexes: by_slug

  Object Structure:
  {
    id: 1,
    slug: "two-sum",
    Title: "Two Sum",
    Difficulty: "Easy",
    Tags: ["Array", "Hash Table"],
    Description: "Given an array of integers...",
    Companies: ["Google", "Amazon"],
    Frequency: 4.5
  }

  ---
  8. backup_storage Store

  Purpose: Store database backups
  Key: backupId
  Indexes: by_backupId

  Object Structure:
  {
    backupId: "latestBackup",
    id: "latestBackup",
    timestamp: "2024-01-15T10:00:00Z",
    data: {
      // Complete database backup data
      stores: {
        problems: { data: [...] },
        attempts: { data: [...] }
      }
    }
  }

  ---
  9. tag_relationships Store

  Purpose: Store tag classifications and relationships for learning progression      
  Key: id (tag name)
  Indexes: by_classification

  Object Structure:
  {
    id: "array",
    classification: "Core Concept",     // Tier: Core Concept, Fundamental
  Technique, Advanced Technique
    relatedTags: {
      "hash-table": 15,                // Relationship strength scores
      "two-pointers": 8,
      "sorting": 12
    }
  }

  ---
  10. tag_mastery Store

  Purpose: Track user mastery progress for each tag
  Key: tag
  Indexes: by_tag

  Object Structure:
  {
    tag: "array",
    strength: 0.75,              // Current mastery strength (0-1)
    decayScore: 0.85,           // Decay factor for spaced repetition
    coreLadder: [],             // Pattern ladder progression
    totalAttempts: 25,          // Total problems attempted with this tag
    successfulAttempts: 20,     // Successful attempts
    lastAttempt: "2024-01-15"   // Last attempt date
  }

  ---
  11. settings Store

  Purpose: Store user preferences and configuration
  Key: id

  Object Structure:
  {
    id: "user_preferences",
    theme: "dark",
    maxDifficulty: "Medium",
    sessionLength: 30,
    adaptiveMode: true
  }

  ---
  12. pattern_ladders Store

  Purpose: Store learning progression ladders for each tag
  Key: tag
  Indexes: by_tag

  Object Structure:
  {
    tag: "dynamic-programming",
    ladder: [
      {
        problemId: "climbing-stairs",
        difficulty: "Easy",
        mastered: true,
        attempts: 3
      },
      {
        problemId: "house-robber",
        difficulty: "Medium",
        mastered: false,
        attempts: 1
      }
    ],
    currentLevel: 2,
    completionRate: 0.6
  }

  ---
  13. session_analytics Store

  Purpose: Store detailed analytics for completed sessions
  Key: sessionId
  Indexes: by_date, by_accuracy, by_difficulty

  Object Structure:
  {
    sessionId: "session-uuid-123",
    completedAt: "2024-01-15T11:30:00Z",

    // Performance metrics
    accuracy: 0.85,
    avgTime: 720,

    // Difficulty analysis
    predominantDifficulty: "Medium",
    totalProblems: 8,
    difficultyMix: {
      Easy: 0.25,
      Medium: 0.625,
      Hard: 0.125
    },

    // Mastery progression
    newMasteries: ["two-pointers"],
    decayedMasteries: [],
    masteryDeltas: {
      "array": 0.05,
      "hash-table": -0.02
    },

    // Tag performance
    strongTags: ["array", "string"],
    weakTags: ["graph", "dynamic-programming"],
    timingFeedback: "good",

    // AI-generated insights
    insights: [
      "Strong performance on array problems",
      "Consider reviewing graph algorithms"
    ],

    // Detailed breakdown
    difficultyBreakdown: {
      Easy: { attempted: 2, successful: 2, avgTime: 300 },
      Medium: { attempted: 5, successful: 4, avgTime: 800 },
      Hard: { attempted: 1, successful: 0, avgTime: 1200 }
    }
  }

  ---
  🔗 Key Relationships:

  - Sessions ↔ Attempts: sessions.id = attempts.SessionID
  - Problems ↔ Attempts: problems.leetCodeID = attempts.ProblemID
  - Tags ↔ Mastery: tag_relationships.id = tag_mastery.tag
  - Tags ↔ Ladders: tag_relationships.id = pattern_ladders.tag
  - Sessions ↔ Analytics: sessions.id = session_analytics.sessionId

  This IndexedDB structure supports a comprehensive learning management system       
  with spaced repetition, mastery tracking, session analytics, and adaptive
  learning algorithms.