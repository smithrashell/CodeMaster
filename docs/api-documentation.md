# 📡 API Documentation

This guide covers all APIs and interfaces in the CodeMaster Chrome extension, including Chrome messaging patterns, service layer APIs, and database interfaces.

## 📋 Table of Contents

- [Chrome Extension APIs](#-chrome-extension-apis)
- [Service Layer APIs](#-service-layer-apis)
- [Database Layer APIs](#-database-layer-apis)
- [Hook APIs](#-hook-apis)
- [Component APIs](#-component-apis)
- [Message Passing Protocol](#-message-passing-protocol)

---

## 🔧 Chrome Extension APIs

### Chrome Messaging Patterns

All Chrome API interactions use the standardized `useChromeMessage` hook pattern:

```javascript
import { useChromeMessage } from '../hooks/useChromeMessage';

const { data, loading, error } = useChromeMessage(
  message,      // Message object to send
  dependencies, // Dependency array (like useEffect)
  options       // Success/error callbacks and options
);
```

### Message Types

#### Session Management

```javascript
// Create new session
const { data: session } = useChromeMessage(
  { type: 'createSession', preferences: { difficulty: 'Medium' } },
  []
);

// Get current session
const { data: currentSession } = useChromeMessage(
  { type: 'getCurrentSession' },
  []
);

// Complete session
const { data: results } = useChromeMessage(
  { type: 'completeSession', sessionId, performance: {...} },
  [sessionId]
);
```

#### Settings Management

```javascript
// Get user settings
const { data: settings } = useChromeMessage(
  { type: 'getSettings' },
  []
);

// Update settings
const { data: updated } = useChromeMessage(
  { type: 'updateSettings', settings: newSettings },
  [newSettings]
);
```

#### Problem Management

```javascript
// Get problem limits
const { data: limits } = useChromeMessage(
  { type: 'getLimits', id: problemId },
  [problemId]
);

// Record problem attempt
const { data: result } = useChromeMessage(
  { 
    type: 'recordAttempt', 
    data: {
      problemId,
      success: true,
      timeSpent: 1200,
      sessionId
    }
  },
  [problemId, sessionId]
);
```

#### Analytics and Statistics

```javascript
// Get dashboard statistics
const { data: stats } = useChromeMessage(
  { type: 'getDashboardStats' },
  []
);

// Get problem statistics by box level
const { data: boxStats } = useChromeMessage(
  { type: 'getProblemStatsByBox' },
  []
);
```

### Background Script API

The background service worker handles all Chrome API interactions:

```javascript
// Background script message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'createSession':
      return handleCreateSession(message, sendResponse);
    case 'getSettings':
      return handleGetSettings(message, sendResponse);
    // ... other handlers
  }
  return true; // Keep message channel open
});
```

---

## 🎯 Service Layer APIs

The service layer provides 17 specialized services for business logic. All services follow consistent patterns and never expose IndexedDB directly.

> **Reference**: Complete service documentation in [chrome-extension-app/src/shared/services/README.md](../chrome-extension-app/src/shared/services/README.md)

### Core Services

#### ProblemService

**Purpose**: Adaptive session creation and problem selection

```javascript
import { ProblemService } from '../services/problemService';

// Create adaptive learning session
const session = await ProblemService.createAdaptiveSession({
  sessionLength: 10,
  focusTags: ['dynamic-programming'],
  difficulty: 'Medium'
});

// Get problems by criteria
const problems = await ProblemService.getSessionProblems({
  tags: ['array', 'two-pointers'],
  count: 5,
  excludeRecent: true
});

// Get problem by description/slug
const problem = await ProblemService.getProblemByDescription('two-sum');
```

#### SessionService

**Purpose**: Session lifecycle management and performance analysis

```javascript
import { SessionService } from '../services/sessionService';

// Build session object
const sessionData = await SessionService.buildSession({
  problems: selectedProblems,
  type: 'adaptive',
  settings: userPreferences
});

// Complete session with performance analysis
const results = await SessionService.summarizeSessionPerformance({
  sessionId,
  attempts: attemptData,
  timeSpent: totalTime
});

// Get session performance metrics
const performance = await SessionService.getSessionPerformance(sessionId);
```

#### TagService

**Purpose**: Algorithm pattern mastery and learning state

```javascript
import { TagService } from '../services/tagServices';

// Get current learning state across all tags
const learningState = await TagService.getCurrentLearningState();

// Get tags needing focused practice
const focusTags = await TagService.getIntelligentFocusTags({
  limit: 3,
  minAttempts: 5
});

// Update tag mastery after attempts
await TagService.updateTagMastery({
  tag: 'dynamic-programming',
  success: true,
  difficulty: 'Hard',
  timeSpent: 1800
});

// Get mastery level for specific tag
const mastery = await TagService.getTagMastery('binary-search');
```

#### AttemptsService

**Purpose**: Problem attempt tracking and statistics

```javascript
import { AttemptsService } from '../services/attemptsService';

// Record individual attempt
await AttemptsService.recordAttempt({
  problemId: 'two-sum',
  sessionId: 'session-123',
  success: true,
  timeSpent: 900,
  difficulty: 'Easy',
  tags: ['array', 'hash-table'],
  notes: 'Used HashMap approach'
});

// Get attempt history for problem
const history = await AttemptsService.getAttemptHistory('two-sum', {
  limit: 10,
  includeStats: true
});

// Calculate success rates
const stats = await AttemptsService.calculateSuccessRates({
  tag: 'dynamic-programming',
  timeframe: '30d'
});
```

#### ScheduleService

**Purpose**: FSRS-based spaced repetition scheduling

```javascript
import { ScheduleService } from '../services/scheduleService';

// Get daily review schedule
const schedule = await ScheduleService.getDailyReviewSchedule({
  date: new Date(),
  maxItems: 20
});

// Calculate next review time
const nextReview = await ScheduleService.calculateNextReview({
  problemId: 'two-sum',
  grade: 4, // FSRS grade (1-5)
  previousReviews: attemptHistory
});

// Update FSRS parameters
await ScheduleService.updateCardParameters({
  problemId: 'two-sum',
  grade: 4,
  reviewTime: Date.now()
});
```

### Supporting Services

#### StrategyService

**Purpose**: Algorithm hints and educational content

```javascript
import { StrategyService } from '../services/strategyService';

// Get contextual hints for algorithm patterns
const strategy = await StrategyService.getTagStrategy(['dynamic-programming']);
// Returns: { hints: [...], primers: [...], examples: [...] }

// Generate educational primers
const primers = await StrategyService.generatePrimers('binary-search');
```

#### DashboardService

**Purpose**: Analytics data aggregation

```javascript
import { DashboardService } from '../services/dashboardService';

// Get comprehensive dashboard statistics
const stats = await DashboardService.getDashboardStatistics();
// Returns: { tagMastery, sessionTrends, recentActivity, achievements }

// Generate performance insights
const insights = await DashboardService.generateInsights({
  timeframe: '7d',
  focusAreas: ['weak-tags', 'improvement-trends']
});
```

---

## 🗄️ Database Layer APIs

The database layer provides IndexedDB abstraction with 17 specialized stores. Components never access this layer directly - always through services.

> **Reference**: Complete database documentation in [chrome-extension-app/src/shared/db/README.md](../chrome-extension-app/src/shared/db/README.md)

### Database Helper

```javascript
import { dbHelper } from '../db/index';

// Primary database connection
const db = await dbHelper.openDB();

// Get object store (readonly/readwrite)
const store = await dbHelper.getStore('problems', 'readwrite');

// Ensure index exists
dbHelper.ensureIndex(store, 'by_difficulty', 'difficulty');
```

### Store APIs

#### Problems Store

```javascript
import { addProblem, updateProblemInDB, fetchAllProblems } from '../db/problems';

// Add new problem
await addProblem({
  leetCodeID: 'two-sum',
  title: 'Two Sum',
  difficulty: 'Easy',
  tags: ['array', 'hash-table'],
  boxLevel: 1,
  stability: 2.5,
  lastReviewed: Date.now()
});

// Update problem state
await updateProblemInDB('two-sum', {
  boxLevel: 2,
  stability: 3.2,
  lastReviewed: Date.now()
});

// Fetch problems with filtering
const problems = await fetchAllProblems({
  tags: ['dynamic-programming'],
  difficulty: 'Medium',
  boxLevel: [1, 2, 3]
});
```

#### Sessions Store

```javascript
import { saveNewSessionToDB, updateSessionInDB, getSessionById } from '../db/sessions';

// Create new session
await saveNewSessionToDB({
  id: 'session-123',
  type: 'adaptive',
  problems: ['two-sum', 'add-two-numbers'],
  settings: { timeLimit: 1800 },
  startTime: Date.now(),
  status: 'active'
});

// Update session progress
await updateSessionInDB('session-123', {
  completedProblems: ['two-sum'],
  currentProblem: 'add-two-numbers',
  timeSpent: 900
});

// Get session data
const session = await getSessionById('session-123');
```

#### Tag Mastery Store

```javascript
import { calculateTagMastery, getTagMastery, updateTagMasteryScore } from '../db/tag_mastery';

// Recalculate all tag mastery scores
await calculateTagMastery();

// Get mastery for specific tag
const mastery = await getTagMastery('dynamic-programming');
// Returns: { score, level, attempts, successRate, lastUpdated }

// Update mastery score
await updateTagMasteryScore('array', 0.15); // Increase by 0.15
```

---

## 🎣 Hook APIs

### useChromeMessage Hook

**Purpose**: Standardized Chrome API communication

```javascript
import { useChromeMessage } from '../hooks/useChromeMessage';

// Basic usage
const { data, loading, error } = useChromeMessage(
  { type: 'getSettings' },  // Message to send
  []                        // Dependencies (like useEffect)
);

// With callbacks
const { data, loading, error } = useChromeMessage(
  { type: 'createSession', data: sessionData },
  [sessionData],
  {
    onSuccess: (response) => {
      console.log('Session created:', response.sessionId);
      setCurrentSession(response.session);
    },
    onError: (error) => {
      console.error('Session creation failed:', error);
      setErrorMessage(`Failed to create session: ${error.message}`);
    }
  }
);

// Conditional requests
const { data, loading } = useChromeMessage(
  shouldFetch ? { type: 'getData' } : null, // null skips the request
  [shouldFetch]
);
```

**Return Value**:
```javascript
{
  data: any,           // Response data (null initially)
  loading: boolean,    // Request in progress
  error: string|null,  // Error message if failed
  retry: () => void    // Function to retry the request
}
```

### useStrategy Hook

**Purpose**: Algorithm strategy and hint management

```javascript
import { useStrategy } from '../hooks/useStrategy';

const {
  hints,           // Array of contextual hints
  primers,         // Educational primers for concepts
  loading,         // Loading state
  error,           // Error message
  hasHints,        // Boolean: hints available
  refreshStrategy, // Function to reload strategy
  getTagStrategy   // Function to get strategy for specific tags
} = useStrategy(problemTags);

// Usage example
const ProblemHints = ({ tags }) => {
  const { hints, loading, hasHints } = useStrategy(tags);
  
  if (loading) return <LoadingSpinner />;
  if (!hasHints) return <NoHintsMessage />;
  
  return (
    <div className="hints-panel">
      {hints.map((hint, index) => (
        <HintCard key={index} hint={hint} />
      ))}
    </div>
  );
};
```

---

## 🧩 Component APIs

### Shared Components

#### TimerComponent

```javascript
import TimerComponent from '../shared/components/timercomponent';

<TimerComponent
  problemId="two-sum"
  timeLimit={1800}          // Time limit in seconds
  onTimeUp={() => {}}       // Callback when time expires
  onSubmit={(time) => {}}   // Callback with time spent
  autoStart={true}          // Start timer automatically
  showHints={true}          // Show hint button
/>
```

#### DataIntegrityDashboard

```javascript
import DataIntegrityDashboard from '../shared/components/DataIntegrityDashboard';

<DataIntegrityDashboard
  showDetails={true}        // Show detailed analysis
  onRepair={(issues) => {}} // Callback for repair actions
  refreshInterval={30000}   // Auto-refresh interval (ms)
/>
```

#### ThemeToggle

```javascript
import ThemeToggle from '../shared/components/ThemeToggle';

<ThemeToggle
  size="small"              // 'small' | 'medium' | 'large'
  showLabel={true}          // Show theme label
  position="top-right"      // Positioning hint
/>
```

### Content Script Components

#### ProblemInfoIcon

```javascript
import ProblemInfoIcon from '../content/components/problem/ProblemInfoIcon';

<ProblemInfoIcon
  problemId="two-sum"
  tags={['array', 'hash-table']}
  difficulty="Easy"
  showReasoning={true}      // Show "Why This Problem?" tooltip
/>
```

#### HintPanel

```javascript
import HintPanel from '../content/components/strategy/HintPanel';

<HintPanel
  tags={problemTags}
  position="right"          // 'left' | 'right' | 'bottom'
  collapsible={true}        // Allow collapse/expand
  trackUsage={true}         // Track hint usage analytics
/>
```

---

## 📬 Message Passing Protocol

### Background Script Communication

All communication between content scripts, popup, and background script follows this protocol:

#### Message Structure

```javascript
// Standard message format
{
  type: string,           // Message type identifier
  data?: any,            // Optional payload data
  timestamp?: number,     // Message timestamp
  sender?: string        // Component identifier
}

// Response format
{
  success: boolean,       // Operation success status
  data?: any,            // Response payload
  error?: string,        // Error message if failed
  timestamp: number      // Response timestamp
}
```

#### Message Types Reference

**Session Management**:
- `createSession` - Create new learning session
- `getCurrentSession` - Get active session data  
- `completeSession` - Mark session as complete
- `updateSession` - Update session progress

**Settings & Storage**:
- `getSettings` - Retrieve user settings
- `updateSettings` - Update user preferences
- `backupData` - Create database backup
- `restoreData` - Restore from backup

**Problem & Attempt Management**:
- `recordAttempt` - Log problem attempt
- `getLimits` - Get time limits for problem
- `updateLimits` - Modify problem time limits
- `getProblemStats` - Get problem statistics

**Analytics & Dashboard**:
- `getDashboardStats` - Get dashboard metrics
- `getProblemStatsByBox` - Get Leitner box distribution
- `getSessionAnalytics` - Get detailed session analysis
- `generateInsights` - Create performance insights

#### Error Handling

```javascript
// Background script error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.type) {
      case 'createSession':
        return handleCreateSession(message, sendResponse);
      default:
        sendResponse({
          success: false,
          error: `Unknown message type: ${message.type}`
        });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
  return true;
});
```

---

## 🔧 API Usage Examples

### Complete Session Creation Flow

```javascript
// 1. Component initiates session creation
const CreateSession = () => {
  const [sessionData, setSessionData] = useState(null);
  
  const { data: session, loading, error } = useChromeMessage(
    { 
      type: 'createSession',
      data: {
        preferences: { difficulty: 'Medium', tags: ['array'] },
        sessionLength: 10
      }
    },
    [],
    {
      onSuccess: (response) => {
        setSessionData(response.session);
        // Navigate to session view
        navigate(`/session/${response.session.id}`);
      },
      onError: (error) => {
        console.error('Session creation failed:', error);
      }
    }
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <SessionView session={sessionData} />;
};

// 2. Background script handles the request
const handleCreateSession = async (message, sendResponse) => {
  try {
    // Business logic through service layer
    const session = await ProblemService.createAdaptiveSession(message.data);
    const sessionData = await SessionService.buildSession(session);
    
    sendResponse({
      success: true,
      session: sessionData,
      timestamp: Date.now()
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
};
```

### Problem Attempt Recording

```javascript
// Content script records attempt
const recordProblemAttempt = async (attemptData) => {
  const { data, error } = await useChromeMessage(
    {
      type: 'recordAttempt',
      data: {
        problemId: 'two-sum',
        success: true,
        timeSpent: 900,
        sessionId: currentSession.id,
        approach: 'hashtable',
        notes: 'Efficient O(n) solution'
      }
    },
    []
  );

  if (error) {
    console.error('Failed to record attempt:', error);
    return;
  }

  // Update UI with new mastery data
  setMasteryUpdate(data.masteryChanges);
};

// Background script processes attempt
const handleRecordAttempt = async (message, sendResponse) => {
  try {
    // Record through service layer
    await AttemptsService.recordAttempt(message.data);
    
    // Update session progress
    const sessionUpdate = await SessionService.updateSessionProgress(
      message.data.sessionId,
      message.data
    );
    
    // Update tag mastery
    const masteryChanges = await TagService.updateTagMastery({
      tags: message.data.tags,
      success: message.data.success,
      timeSpent: message.data.timeSpent
    });

    sendResponse({
      success: true,
      sessionUpdate,
      masteryChanges,
      timestamp: Date.now()
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
};
```

---

## 📚 Additional Resources

### TypeScript Definitions

For better development experience, consider adding TypeScript:

```typescript
// types/chrome-messages.ts
export interface ChromeMessage {
  type: string;
  data?: any;
  timestamp?: number;
  sender?: string;
}

export interface ChromeResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

// types/services.ts
export interface ProblemAttempt {
  problemId: string;
  sessionId: string;
  success: boolean;
  timeSpent: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  notes?: string;
}
```

### API Testing

```javascript
// Test Chrome message patterns
describe('Chrome Message API', () => {
  it('should handle session creation', async () => {
    const mockResponse = { session: { id: 'test-123' } };
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ success: true, ...mockResponse });
    });

    const { result } = renderHook(() => 
      useChromeMessage({ type: 'createSession' }, [])
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockResponse);
    });
  });
});
```

### Performance Monitoring

```javascript
// Monitor API performance
const performanceLogger = {
  logChromeMessage: (type, startTime) => {
    const duration = Date.now() - startTime;
    console.log(`Chrome API ${type}: ${duration}ms`);
    
    // Report to analytics in production
    if (duration > 1000) {
      console.warn(`Slow Chrome API call: ${type} took ${duration}ms`);
    }
  }
};
```

---

This API documentation provides comprehensive coverage of all interfaces in the CodeMaster Chrome extension. For implementation details, refer to the source code and the excellent existing mini-READMEs in the chrome-extension-app/src/shared/ directories.