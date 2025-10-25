# ADR-002: IndexedDB Storage Strategy

## Status
**Accepted** - Implemented with 13-store schema in Database v25

## Context
CodeMaster requires persistent local storage for user progress, problem data, learning analytics, and spaced repetition scheduling. We needed to choose a storage solution that could handle complex relationships, large datasets, and provide good performance for our learning algorithms.

## Decision
We decided to use **IndexedDB as the primary storage layer** with a comprehensive 13-store schema and service layer abstraction.

## Rationale

### Why IndexedDB?
1. **Large Storage Capacity**: 50MB+ per origin, suitable for extensive problem databases
2. **Complex Queries**: Support for indexes, cursors, and complex filtering
3. **ACID Transactions**: Ensures data consistency across related operations
4. **Asynchronous API**: Non-blocking operations for smooth UI experience
5. **Browser Native**: No external dependencies, works offline

### Why Not Alternatives?

#### Chrome Storage API
**Rejected** because:
- Limited to 5MB storage quota
- Simple key-value only, no complex queries
- No transaction support for related data
- Quota limitations for problem database

#### LocalStorage
**Rejected** because:
- Synchronous API blocks UI thread
- String-only storage requiring serialization
- No query capabilities beyond key lookup
- 5-10MB storage limits

#### External Database (Firebase, Supabase)
**Rejected** because:
- Requires internet connectivity
- User privacy concerns with external storage
- Additional complexity and dependencies
- Latency for real-time learning features

## Implementation Strategy

### Database Schema Design

#### Core Learning Stores
```
review (Database v25)
├── problems              # User's problem progress (Leitner system)
├── sessions              # Learning session data  
├── attempts              # Individual problem attempts
├── tag_mastery          # Algorithm pattern mastery tracking
└── pattern_ladders      # Progressive difficulty sequences
```

#### Supporting Data Stores
```
├── standard_problems    # Canonical LeetCode problem database
├── session_analytics    # Detailed session performance analysis  
├── strategy_data        # Algorithm hints and educational content
├── tag_relationships    # Tag classification and connections
├── problem_relationships # Problem similarity graph
├── limits               # Time and attempt constraints
├── settings             # User preferences and configuration
└── backup_storage       # Database backup and recovery
```

### Service Layer Abstraction

#### Design Principles
1. **No Direct DB Access**: Components never access IndexedDB directly
2. **Service Mediation**: All data operations flow through 17 specialized services
3. **Transaction Management**: Services handle complex multi-store transactions
4. **Error Handling**: Consistent error transformation and user-friendly messages

#### Service Architecture
```javascript
Component Layer (React)
       ↓
Service Layer (Business Logic)
       ↓  
Database Layer (IndexedDB Utilities)
       ↓
IndexedDB (Browser Storage)
```

### Data Relationships

#### Primary Relationships
```
Sessions ↔ Attempts: sessions.id = attempts.sessionId
Problems ↔ Attempts: problems.leetCodeID = attempts.problemId  
Tags ↔ Mastery: tag_relationships.id = tag_mastery.tag
Tags ↔ Ladders: tag_relationships.id = pattern_ladders.tag
Sessions ↔ Analytics: sessions.id = session_analytics.sessionId
```

#### Index Strategy
```javascript
// Performance-critical indexes
attempts.createIndex('by_problemId', 'problemId');
attempts.createIndex('by_sessionId', 'sessionId');
attempts.createIndex('by_date', 'attemptDate');
problems.createIndex('by_boxLevel', 'boxLevel');
sessions.createIndex('by_startTime', 'startTime');
tag_mastery.createIndex('by_score', 'masteryScore');
```

## Implementation Details

### Database Versioning Strategy
```javascript
// Automatic schema migrations
const DB_VERSION = 25;

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;
  
  // Incremental migrations preserve user data
  if (oldVersion < 25) {
    upgradeToVersion25(db, transaction);
  }
};
```

### Transaction Patterns
```javascript
// Multi-store transactions for consistency  
const recordAttemptWithMasteryUpdate = async (attemptData) => {
  const tx = db.transaction(['attempts', 'tag_mastery', 'sessions'], 'readwrite');
  
  try {
    // Record attempt
    await tx.objectStore('attempts').add(attemptData);
    
    // Update mastery
    const masteryStore = tx.objectStore('tag_mastery');
    const mastery = await masteryStore.get(attemptData.tag);
    mastery.score += calculateMasteryDelta(attemptData);
    await masteryStore.put(mastery);
    
    // Update session
    const sessionStore = tx.objectStore('sessions');
    const session = await sessionStore.get(attemptData.sessionId);
    session.completedProblems.push(attemptData.problemId);
    await sessionStore.put(session);
    
    await tx.complete;
  } catch (error) {
    await tx.abort();
    throw error;
  }
};
```

### Performance Optimizations

#### Query Optimization
1. **Strategic Indexing**: Indexes on all frequently queried fields
2. **Cursor Usage**: Efficient iteration over large datasets
3. **Batch Operations**: Group related operations in single transactions
4. **Lazy Loading**: Load data only when needed by UI components

#### Memory Management
1. **Connection Pooling**: Singleton database connection pattern
2. **Cursor Cleanup**: Proper resource disposal after queries
3. **Transaction Scoping**: Minimize transaction duration
4. **Data Pagination**: Limit result sets for large queries

### Error Handling Strategy

#### Database Errors
```javascript
// Comprehensive error catching and transformation
const handleDatabaseOperation = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please free up space.');
    } else if (error.name === 'AbortError') {
      throw new Error('Database operation was interrupted.');
    } else if (error.name === 'VersionError') {
      throw new Error('Database version conflict. Please refresh.');
    } else {
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }
};
```

#### Recovery Mechanisms
1. **Automatic Backup**: Regular exports of critical data
2. **Schema Validation**: Verify data integrity on startup
3. **Migration Rollback**: Revert to previous version on failure
4. **Graceful Degradation**: Fallback to basic functionality

## Consequences

### Positive
- **Rich Query Capabilities**: Complex filtering and sorting for learning algorithms
- **Large Storage Capacity**: Can store thousands of problems and extensive analytics
- **Offline Functionality**: Complete app functionality without internet
- **Transaction Support**: Data consistency across complex operations
- **Performance**: Fast local queries with proper indexing
- **Privacy**: All data remains local to user's machine

### Negative
- **Complexity**: More complex than simple key-value storage
- **Browser Support**: IE11 and older browsers not supported
- **Learning Curve**: Developers need IndexedDB knowledge
- **Debugging Difficulty**: More complex to inspect and debug
- **Migration Complexity**: Schema changes require careful migration logic

### Mitigation Strategies
1. **Service Layer Abstraction**: Hide IndexedDB complexity from components
2. **Comprehensive Testing**: Extensive test coverage for database operations
3. **Development Tools**: Browser DevTools integration for inspection
4. **Documentation**: Detailed schema and API documentation
5. **Migration Testing**: Automated tests for schema migrations

## Success Metrics

### Performance Targets
- **Database Open Time**: < 100ms
- **Simple Queries**: < 50ms average
- **Complex Aggregations**: < 200ms average
- **Transaction Completion**: < 100ms for typical operations

### Storage Efficiency
- **Data Compression**: < 1MB storage per 1000 problems
- **Index Overhead**: < 20% of total storage
- **Backup Size**: < 500KB for typical user data

### Reliability Metrics
- **Data Corruption Rate**: < 0.01% of operations
- **Migration Success**: > 99.5% of version upgrades
- **Recovery Success**: > 95% of backup restores

## Future Considerations

### Potential Migrations
1. **WebSQL to IndexedDB**: Already completed (v1.0)
2. **Cloud Sync**: Optional cloud backup for cross-device sync
3. **Shared Workers**: Multi-tab database coordination
4. **Web Locks API**: Enhanced concurrent access control

### Schema Evolution
1. **Sharding Strategy**: Split large stores if performance degrades
2. **Compression**: Data compression for storage efficiency  
3. **Archival**: Move old data to separate archival stores
4. **Real-time Sync**: Operational transform for concurrent editing

### Alternative Considerations
1. **WASM SQLite**: If complex SQL queries become necessary
2. **OPFS**: Origin Private File System for large file storage
3. **WebCodecs**: Binary data compression for analytics

## Integration Points

### Chrome Extension Integration
```javascript
// Chrome storage as settings backup
const syncSettingsToChrome = async (settings) => {
  await chrome.storage.local.set({ 
    settingsBackup: settings,
    lastSync: Date.now()
  });
};
```

### Service Worker Coordination
```javascript
// Background processing with IndexedDB
self.addEventListener('message', async (event) => {
  if (event.data.type === 'BACKGROUND_ANALYTICS') {
    const db = await openDatabase();
    await processAnalytics(db, event.data.sessionId);
  }
});
```

## References
- [IndexedDB API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Chrome Extension Storage Guidelines](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Database Schema Documentation](../../../chrome-extension-app/src/shared/db/README.md)

## Related ADRs
- ADR-001: Chrome Extension Architecture
- ADR-003: Hook-Based Component Architecture  
- ADR-004: Service Layer Design Pattern