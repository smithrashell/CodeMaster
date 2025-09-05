# Services API Reference

The services layer provides business logic abstraction between UI components and the database layer. All 17 services follow consistent patterns and never expose IndexedDB operations directly to components.

## Core Services

### 🎯 **ProblemService** (`problemService.js`)

**Purpose**: Adaptive session creation and problem selection algorithms

**Key Methods:**
- `createAdaptiveSession()` - Generates personalized learning sessions
- `getSessionProblems()` - Selects problems based on mastery and FSRS
- `getProblemByDescription()` - Fetches problems from standard_problems or problems stores

**Integration**: TagService (mastery analysis), ScheduleService (FSRS), SessionService (session building)

### 📊 **SessionService** (`sessionService.js`)

**Purpose**: Session lifecycle management and performance analysis

**Key Methods:**
- `summarizeSessionPerformance()` - Comprehensive session analysis and mastery updates
- `buildSession()` - Constructs session objects with metadata
- `completeSession()` - Finalizes sessions and triggers analytics

**Integration**: AttemptsService (performance data), TagService (mastery updates), ProblemService (problem relationships)

### 🏷️ **TagService** (`tagServices.js`)

**Purpose**: Tag mastery and learning state management

**Key Methods:**
- `getCurrentLearningState()` - Analyzes current mastery across all tags
- `getIntelligentFocusTags()` - Identifies tags needing focused practice
- `updateTagMastery()` - Recalculates mastery scores after attempts

**Integration**: Database (tag_mastery, pattern_ladders), ScheduleService (FSRS calculations)

### 📈 **AttemptsService** (`attemptsService.js`)

**Purpose**: Problem attempt tracking and statistics

**Key Methods:**
- `recordAttempt()` - Logs individual problem attempts with timing
- `getAttemptHistory()` - Retrieves attempt data for analysis
- `calculateSuccessRates()` - Computes performance metrics

**Integration**: SessionService (session updates), TagService (mastery updates)

### ⏰ **ScheduleService** (`scheduleService.js`)

**Purpose**: Spaced repetition scheduling using FSRS algorithm

**Key Methods:**
- `getDailyReviewSchedule()` - Generates review schedule based on FSRS
- `calculateNextReview()` - Determines optimal review timing
- `updateCardParameters()` - Updates FSRS parameters after attempts

**Integration**: TagService (mastery state), ProblemService (problem selection)

## Supporting Services

### 🎓 **StrategyService** (`strategyService.js`)
- `getTagStrategy()` - Provides contextual hints for algorithm patterns
- `generatePrimers()` - Creates educational content for algorithm concepts

### 🧠 **ProblemReasoningService** (`problemReasoningService.js`)
- `generateReasoning()` - Creates "Why This Problem?" explanations
- `analyzeSelectionContext()` - Provides context for problem recommendations

### 🔗 **ProblemRelationshipService** (`problemRelationshipService.js`)
- `updateRelationships()` - Maintains problem relationship graph
- `findSimilarProblems()` - Identifies related problems for recommendations

### 🗂️ **StorageService** (`storageService.js`)
- `getSettings()` - Retrieves user preferences
- `saveSettings()` - Persists configuration changes

### 📊 **DashboardService** (`dashboardService.js`)
- `getDashboardStatistics()` - Compiles performance metrics
- `generateInsights()` - Creates performance insights

## Advanced Services

### 🛡️ **IndexedDBRetryService** (`IndexedDBRetryService.js`)

**Purpose**: Database operation resilience with retry logic and timeout handling

**Key Methods:**
- `executeWithRetry()` - Executes database operations with exponential backoff
- `createTimeoutPromise()` - Provides timeout handling for long-running operations
- `deduplicateRequests()` - Prevents duplicate simultaneous operations

**Features**: Circuit breaker patterns, operation prioritization, performance monitoring

### 🌐 **ChromeAPIErrorHandler** (`ChromeAPIErrorHandler.js`)

**Purpose**: Robust Chrome extension message handling with error recovery

**Key Methods:**
- `sendMessageWithRetry()` - Chrome messaging with automatic retry and fallback
- `handleChromeError()` - Intelligent error classification and recovery
- `validateChromeResponse()` - Response validation and error detection

**Features**: Exponential backoff, network error handling, extension context validation

## Service Architecture Patterns

### Consistent API Structure

All services follow these patterns:

```javascript
export const ServiceName = {
  // Primary operations
  async primaryOperation(params) {
    // Business logic
    return result;
  },

  // Data retrieval
  async getData(criteria) {
    // Database queries via db layer
    return data;
  },

  // State updates
  async updateState(changes) {
    // State management logic
    return updated;
  },
};
```

### Error Handling
- All services implement consistent error handling
- Database errors are caught and transformed into user-friendly messages
- Async operations include proper error propagation

### Integration Patterns
- Services communicate through well-defined interfaces
- No direct database access from components
- Chrome API access through useChromeMessage hook
- State updates flow through service layer

## Usage Examples

### Component Integration

```javascript
// Component using service through Chrome messaging
const { data, loading, error } = useChromeMessage(
  { type: "createSession" },
  [],
  {
    onSuccess: (response) => setSession(response.session),
    onError: (error) => console.error("Session creation failed:", error),
  }
);
```

### Service Layer Implementation

```javascript
// Background script handler
case "createSession":
  try {
    const session = await ProblemService.createAdaptiveSession(request.params);
    sendResponse({ success: true, session });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
  break;
```

## Testing

Each service has comprehensive test coverage in `__tests__/` directory:
- **Unit Tests**: Individual service method testing
- **Integration Tests**: Service-to-service interaction testing
- **Mock Data**: Standardized test data via `mockDataFactories.js`

Current test coverage: **110 total tests passing** with high coverage across all critical service functions.

## Performance Considerations

### 🛡️ Circuit Breaker Pattern

Services implement automatic fallback to stable functionality when enhanced features fail:

```javascript
const session = await HabitLearningCircuitBreaker.safeExecute(
  () => createEnhancedSession(params),
  () => createBasicSession(params),
  "session-creation"
);
```

### 🔄 Retry Mechanisms

**Database Retry Strategy:**
- Exponential backoff: 100ms → 200ms → 400ms delays
- Max 3 retries for critical operations
- Configurable timeouts per operation type
- Deduplication prevents duplicate operations

**Chrome API Retry Strategy:**
- Network error recovery with automatic retry
- Context validation handles extension context loss
- Response validation retries on malformed responses
- Graceful degradation when Chrome APIs fail

### 📊 Performance Monitoring

Built-in operation tracking captures:
- Operation latency and success rates
- Retry frequency and patterns  
- Error categorization and trends
- Cache hit rates and performance impact

## Service Locations

All services are located in `chrome-extension-app/src/shared/services/`:

**Core Services:**
- `problemService.js` - Problem selection and session creation
- `sessionService.js` - Session management and analytics  
- `tagServices.js` - Tag mastery and learning state
- `attemptsService.js` - Attempt tracking and statistics
- `scheduleService.js` - FSRS spaced repetition scheduling

**Infrastructure Services:**
- `ChromeAPIErrorHandler.js` - Chrome messaging with retry logic
- `IndexedDBRetryService.js` - Database resilience and performance
- `storageService.js` - Chrome storage API wrapper

**Feature Services:**
- `strategyService.js` - Algorithm hints and educational content
- `dashboardService.js` - Analytics data aggregation
- `problemReasoningService.js` - Problem selection explanations
- `problemRelationshipService.js` - Problem similarity analysis

For detailed implementation examples and integration patterns, see the service source files and their corresponding test suites.