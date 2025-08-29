# 🗄️ Data Storage Architecture

> **Current Version**: IndexedDB v24 - Complete learning analytics system

---

## 📊 Database Overview

CodeMaster uses **IndexedDB** for client-side persistent storage, eliminating the need for a backend server. The database schema has evolved to support sophisticated spaced repetition algorithms, adaptive learning, and comprehensive analytics.

**Database Name**: `review`  
**Current Version**: `24`  
**Location**: Browser IndexedDB (Chrome Extension)

---

## 🏗️ Database Schema (v24)

### Core Learning Stores

#### 1. **problems** - Algorithm Problem Repository
```javascript
keyPath: "leetCodeID"
```
**Purpose**: Master repository of algorithm problems with metadata  
**Indexes**: 
- `by_tag` - Problem categorization
- `by_problem` - Problem lookup
- `by_review` - Review scheduling
- `by_ProblemDescription` - Problem identification
- `by_nextProblem` - Problem relationships

**Key Fields**:
- `leetCodeID` - Unique LeetCode problem identifier
- `ProblemDescription` - Problem title and description
- `tag` - Algorithm pattern tags (Arrays, Hash Table, etc.)
- `difficulty` - Easy, Medium, Hard
- `review` - Review scheduling metadata

#### 2. **attempts** - User Solution Tracking
```javascript
keyPath: "id" (autoIncrement)
```
**Purpose**: Records every problem attempt with performance metrics  
**Indexes**:
- `by_date` - Temporal analysis
- `by_problem_and_date` - Problem history
- `by_problemId` - Problem-specific attempts
- `by_sessionId` - Session grouping

**Key Fields**:
- `problemId` - Reference to problems store
- `sessionId` - Associated learning session
- `success` - Boolean success indicator
- `timeSpent` - Duration in milliseconds
- `date` - ISO timestamp
- `boxLevel` - Leitner system box level
- `tags` - Associated algorithm patterns

#### 3. **sessions** - Learning Session Management
```javascript
keyPath: "id" (manual sessionID)
```
**Purpose**: Orchestrates learning sessions with adaptive algorithms  
**Indexes**:
- `by_date` - Session timeline

**Key Fields**:
- `id` - Unique session identifier
- `Date` - Session creation timestamp
- `problems` - Array of session problems
- `settings` - Adaptive session configuration
- `completed` - Session completion status
- `performance` - Session metrics

---

### Advanced Learning Features

#### 4. **tag_mastery** - Pattern Mastery Tracking
```javascript
keyPath: "tag"
```
**Purpose**: Tracks learning progress per algorithm pattern  

**Key Fields**:
- `tag` - Algorithm pattern name
- `masteryLevel` - Success rate percentage
- `attempts` - Total attempts for this tag
- `successfulAttempts` - Successful attempts count
- `lastAttemptDate` - Most recent practice
- `boxLevel` - Average Leitner box level
- `decayScore` - Forgetting curve calculation

#### 5. **pattern_ladders** - Learning Progressions
```javascript
keyPath: "tag"
```
**Purpose**: Structured learning paths for each algorithm pattern  

**Key Fields**:
- `tag` - Algorithm pattern name
- `problems` - Ordered array of problems for progression
- `difficulty` - Difficulty tier (Core, Fundamental, Advanced)
- `prerequisites` - Required tags before unlocking

#### 6. **session_analytics** - Performance Analytics
```javascript
keyPath: "sessionId"
```
**Purpose**: Historical session performance for dashboard analytics  

**Key Fields**:
- `sessionId` - Reference to sessions store
- `accuracy` - Session success rate
- `efficiency` - Time performance metrics  
- `masteryProgression` - Tag mastery improvements
- `insights` - AI-generated performance feedback
- `recommendations` - Next steps suggestions

---

### Relationship & Intelligence Stores

#### 7. **problem_relationships** - Problem Similarity
```javascript
keyPath: auto-generated
```
**Purpose**: Problem-to-problem relationships for intelligent selection  
**Indexes**:
- `by_problemId1` - Source problem lookup
- `by_problemId2` - Target problem lookup

**Key Fields**:
- `problemId1` - Source problem reference
- `problemId2` - Related problem reference  
- `similarity` - Relationship strength (0-1)
- `sharedTags` - Common algorithm patterns

#### 8. **tag_relationships** - Pattern Connections
```javascript
keyPath: "id"
```
**Purpose**: Algorithm pattern relationships for learning paths  

**Key Fields**:
- `tag1` - Source algorithm pattern
- `tag2` - Related algorithm pattern
- `strength` - Relationship strength
- `type` - Relationship type (prerequisite, related, advanced)

---

### System & Configuration Stores

#### 9. **session_state** - Current Learning State
```javascript
keyPath: "id"
```
**Purpose**: Persistent learning state across browser sessions  

**Key Fields**:
- `currentTier` - Learning tier (Core, Fundamental, Advanced)
- `focusTags` - Active learning focus tags
- `tagIndex` - Position in focus window
- `learningVelocity` - Progress tracking metrics

#### 10. **settings** - User Preferences
```javascript
keyPath: "id"
```
**Purpose**: User configuration and adaptive learning parameters  

**Key Fields**:
- `adaptiveSessionsEnabled` - Toggle adaptive features
- `sessionLength` - Preferred session duration
- `difficultyPreference` - Difficulty bias settings
- `theme` - UI theme preferences

#### 11. **standard_problems** - Problem Templates
```javascript
keyPath: "id" (autoIncrement)
```
**Purpose**: Template problems for session generation  

#### 12. **backup_storage** - Data Backup
```javascript
keyPath: "backupId"
```
**Purpose**: Backup and restore functionality  

#### 13. **limits** - Usage Tracking
```javascript
keyPath: "id" (autoIncrement)
```
**Purpose**: Usage limits and quota management  
**Indexes**:
- `by_createAt` - Usage timeline

---

## 🔄 Data Flow Architecture

### Learning Session Lifecycle
```
1. Session Creation (sessions store)
    ↓
2. Problem Selection (problems + relationships)
    ↓  
3. User Attempts (attempts store)
    ↓
4. FSRS Processing (tag_mastery updates)
    ↓
5. Analytics Generation (session_analytics)
    ↓
6. State Updates (session_state)
```

### Adaptive Learning Pipeline
```
Tag Mastery Calculation → Focus Tag Selection → Problem Selection → 
Session Generation → Performance Tracking → Mastery Updates
```

---

## 🎯 Key Design Principles

### 1. **Offline-First Architecture**
- Complete functionality without internet connection
- All data stored locally in IndexedDB
- No dependency on external databases

### 2. **Spaced Repetition Integration**
- FSRS algorithm calculations stored in attempts
- Box levels track review scheduling
- Decay scores model forgetting curves

### 3. **Relationship-Driven Intelligence**
- Problem relationships enable intelligent sequencing
- Tag relationships create learning pathways
- Pattern ladders provide structured progression

### 4. **Comprehensive Analytics**
- Session analytics enable dashboard visualizations
- Tag mastery tracking shows learning progress
- Performance metrics optimize future sessions

---

## 🔧 Database Operations

### Common Queries

**Get Tag Mastery Progress**:
```javascript
const tagMastery = await tagMasteryService.getAllTagMastery();
```

**Fetch Session Problems**:
```javascript
const sessionProblems = await problemService.fetchProblemsForSession(settings);
```

**Record Problem Attempt**:
```javascript
await attemptsService.addAttempt({
  problemId: problem.leetCodeID,
  sessionId: sessionId,
  success: true,
  timeSpent: 1200000,
  tags: problem.tags
});
```

**Generate Session Analytics**:
```javascript
const analytics = await sessionService.summarizeSessionPerformance(session);
```

### Performance Optimizations

**Indexed Queries**: All frequent lookups use indexes for fast retrieval  
**Batch Operations**: Multiple database operations grouped in transactions  
**Lazy Loading**: Large datasets loaded on demand  
**Caching**: Frequently accessed data cached in memory

---

## 📈 Migration History

**v22 → v24**: Added `session_analytics` store for comprehensive performance tracking  
**v21 → v22**: Enhanced session state management and settings migration to IndexedDB  
**Previous versions**: Progressive addition of relationship stores, tag mastery, and pattern ladders

---

## 🔗 Related Documentation

- **[Session Management](../Sessions/Sessions.md)** - How sessions use database stores
- **[Tag Mastery System](../Tag%20Generation/Tag%20Generation.md)** - Tag mastery calculations
- **[FSRS Implementation](../Review%20Schedule/Learning%20Algorithm%20FSRS.md)** - Spaced repetition algorithms
- **[Problem Relationships](../Problem%20Relationships/About%20Weighted%20Graphs.md)** - Relationship calculations

---

*The IndexedDB architecture provides the foundation for CodeMaster's sophisticated adaptive learning system, enabling offline functionality with enterprise-grade analytics capabilities.*