# Services Layer

The services layer provides business logic abstraction between UI components and the database layer. All 17 services follow consistent patterns and never expose IndexedDB operations directly to components.

## Core Services

### 🎯 **ProblemService** (`problemService.js`)

**Purpose**: Adaptive session creation and problem selection algorithms

- `createAdaptiveSession()` - Generates personalized learning sessions
- `getSessionProblems()` - Selects problems based on mastery and FSRS
- `getProblemByDescription()` - Fetches problems from standard_problems or problems stores
- **Key Integration**: TagService (mastery analysis), ScheduleService (FSRS), SessionService (session building)

### 📊 **SessionService** (`sessionService.js`)

**Purpose**: Session lifecycle management and performance analysis

- `summarizeSessionPerformance()` - Comprehensive session analysis and mastery updates
- `buildSession()` - Constructs session objects with metadata
- `completeSession()` - Finalizes sessions and triggers analytics
- **Key Integration**: AttemptsService (performance data), TagService (mastery updates), ProblemService (problem relationships)

### 🏷️ **TagService** (`tagServices.js`)

**Purpose**: Tag mastery and learning state management

- `getCurrentLearningState()` - Analyzes current mastery across all tags
- `getIntelligentFocusTags()` - Identifies tags needing focused practice
- `updateTagMastery()` - Recalculates mastery scores after attempts
- **Key Integration**: Database (tag_mastery, pattern_ladders), ScheduleService (FSRS calculations)

### 📈 **AttemptsService** (`attemptsService.js`)

**Purpose**: Problem attempt tracking and statistics

- `recordAttempt()` - Logs individual problem attempts with timing
- `getAttemptHistory()` - Retrieves attempt data for analysis
- `calculateSuccessRates()` - Computes performance metrics
- **Key Integration**: SessionService (session updates), TagService (mastery updates)

### ⏰ **ScheduleService** (`scheduleService.js`)

**Purpose**: Spaced repetition scheduling using FSRS algorithm

- `getDailyReviewSchedule()` - Generates review schedule based on FSRS
- `calculateNextReview()` - Determines optimal review timing
- `updateCardParameters()` - Updates FSRS parameters after attempts
- **Key Integration**: TagService (mastery state), ProblemService (problem selection)

## Supporting Services

### 🎓 **StrategyService** (`strategyService.js`)

**Purpose**: Algorithm strategy and hint generation

- `getTagStrategy()` - Provides contextual hints for algorithm patterns
- `generatePrimers()` - Creates educational content for algorithm concepts
- **Integration**: useStrategy hook, strategy_data store

### 🧠 **ProblemReasoningService** (`problemReasoningService.js`)

**Purpose**: Transparent problem selection reasoning

- `generateReasoning()` - Creates "Why This Problem?" explanations
- `analyzeSelectionContext()` - Provides context for problem recommendations
- **Integration**: ProblemService (session creation), UI (ProblemInfoIcon)

### 🔗 **ProblemRelationshipService** (`problemRelationshipService.js`)

**Purpose**: Problem similarity and relationship analysis

- `updateRelationships()` - Maintains problem relationship graph
- `findSimilarProblems()` - Identifies related problems for recommendations
- **Integration**: SessionService (relationship updates), problem_relationships store

### 🗂️ **StorageService** (`storageService.js`)

**Purpose**: Chrome storage API wrapper

- `getSettings()` - Retrieves user preferences
- `saveSettings()` - Persists configuration changes
- **Integration**: useChromeMessage hook, Chrome storage API

### 🧭 **NavigationService** (`navigationService.js`)

**Purpose**: Inter-component routing and state management

- `navigateToSession()` - Handles session navigation
- `trackRouteState()` - Maintains navigation history
- **Integration**: React Router, session_state store

### 🎬 **OnboardingService** (`onboardingService.js`)

**Purpose**: User initialization and first-time setup

- `checkOnboardingStatus()` - Determines if user needs onboarding
- `completeOnboarding()` - Finalizes user setup
- **Integration**: Background script, main navigation component

### 📊 **DashboardService** (`dashboardService.js`)

**Purpose**: Analytics data aggregation for dashboard

- `getDashboardStatistics()` - Compiles performance metrics
- `generateInsights()` - Creates performance insights
- **Integration**: session_analytics store, Dashboard components

### ⭐ **RatingService** (`ratingService.js`)

**Purpose**: Problem difficulty and rating management

- `updateProblemRatings()` - Maintains problem difficulty scores
- `calibrateRatings()` - Adjusts ratings based on user performance
- **Integration**: ProblemService, problems store

### 🗄️ **RelationshipService** (`relationshipService.js`)

**Purpose**: Tag and problem relationship management

- `calculateTagRelationships()` - Maintains tag relationship strengths
- `updateRelationshipScores()` - Adjusts relationship weights
- **Integration**: tag_relationships store, TagService

### 📏 **LimitService** (`limitService.js`)

**Purpose**: Time and attempt limit management

- `getProblemLimits()` - Retrieves time limits for problems
- `updateLimits()` - Adjusts limits based on difficulty and performance
- **Integration**: limits store, TimerComponent

### 🏗️ **ProblemLadderService** (`problemladderService.js`)

**Purpose**: Pattern ladder progression management

- `updateLadderProgress()` - Tracks progression through difficulty ladders
- `getNextLadderProblem()` - Selects next problem in progression sequence
- **Integration**: pattern_ladders store, TagService

### 🔄 **IndexedDBRetryService** (`IndexedDBRetryService.js`)

**Purpose**: Database operation resilience with retry logic and timeout handling

- `executeWithRetry()` - Executes database operations with exponential backoff
- `createTimeoutPromise()` - Provides timeout handling for long-running operations
- `deduplicateRequests()` - Prevents duplicate simultaneous operations
- **Key Features**: Circuit breaker patterns, operation prioritization, performance monitoring
- **Integration**: Used by all database operations for enhanced reliability

### 🌐 **ChromeAPIErrorHandler** (`ChromeAPIErrorHandler.js`)

**Purpose**: Robust Chrome extension message handling with error recovery

- `sendMessageWithRetry()` - Chrome messaging with automatic retry and fallback
- `handleChromeError()` - Intelligent error classification and recovery
- `validateChromeResponse()` - Response validation and error detection
- **Key Features**: Exponential backoff, network error handling, extension context validation
- **Integration**: Core infrastructure for all Chrome messaging, useChromeMessage hook

## Service Patterns & Advanced Features

### 🛡️ Circuit Breaker Pattern

**Purpose**: Provides automatic fallback to stable functionality when enhanced features fail

**Implementation**:
```javascript
class HabitLearningCircuitBreaker {
  static isOpen = false;
  static failureCount = 0;
  static MAX_FAILURES = 3;
  static RECOVERY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  static async safeExecute(enhancedFn, fallbackFn, operationName) {
    // Automatic reset after recovery timeout
    if (this.isOpen && this.shouldAttemptReset()) {
      this.reset();
    }
    
    // Use fallback if circuit is open
    if (this.isOpen) {
      return await fallbackFn();
    }
    
    try {
      const result = await enhancedFn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      return await fallbackFn();
    }
  }
}
```

**Usage in Services**:
```javascript
// SessionService example
const session = await HabitLearningCircuitBreaker.safeExecute(
  () => createEnhancedSession(params),
  () => createBasicSession(params),
  "session-creation"
);
```

**Benefits**:
- **Automatic Recovery**: Circuit resets after timeout period
- **Zero Downtime**: Fallback ensures system continues working
- **Performance Protection**: Prevents cascading failures
- **Gradual Enhancement**: New features can be added safely

### 🔄 Retry Mechanisms

**Database Retry Strategy**:
- **Exponential Backoff**: 100ms → 200ms → 400ms delays
- **Max Attempts**: 3 retries for critical operations
- **Timeout Handling**: Configurable timeouts per operation type
- **Deduplication**: Prevents duplicate simultaneous operations

**Chrome API Retry Strategy**:
- **Network Error Recovery**: Automatic retry for connection failures
- **Context Validation**: Handles extension context loss gracefully
- **Response Validation**: Retries on malformed responses
- **Fallback Mechanisms**: Graceful degradation when Chrome APIs fail

### 📊 Performance Monitoring

**Operation Tracking**:
```javascript
// Built into IndexedDBRetryService
const performanceData = {
  operationName: "getSessionData",
  startTime: Date.now(),
  retryCount: 2,
  totalTime: 150, // ms
  success: true,
  error: null
};
```

**Metrics Captured**:
- Operation latency and success rates
- Retry frequency and patterns  
- Error categorization and trends
- Cache hit rates and performance impact

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

## Testing

Each service has comprehensive test coverage in `__tests__/` directory:

- **Unit Tests**: Individual service method testing
- **Integration Tests**: Service-to-service interaction testing
- **Mock Data**: Standardized test data via `mockDataFactories.js`

Current test coverage: **110 total tests passing** with high coverage across all critical service functions.
