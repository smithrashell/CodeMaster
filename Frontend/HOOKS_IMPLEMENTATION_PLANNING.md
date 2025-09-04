# Custom Hooks Implementation Planning

## useChromeRuntime Hook

### Purpose & Scope

Standardize Chrome extension runtime communication across 21+ components that currently handle `chrome.runtime` manually.

### Current Usage Analysis

**Components using chrome.runtime:**

- `popup.jsx` - Opens app tabs
- `timercomponent.jsx` - Gets time limits, sends completion data
- `main.jsx` - Tab communication
- `probgen.jsx` - Session data management
- `probdetail.jsx` - Problem data fetching
- `probtime.jsx` - Timer synchronization
- `settings.jsx` - Configuration persistence
- `probstat.jsx` - Statistics collection
- `probsubmission.jsx` - Submission tracking
- `background.js` - Service worker messaging
- And 11+ more components...

### API Design

```javascript
export const useChromeRuntime = (options = {}) => {
  // Configuration
  const {
    timeout = 5000,
    retries = 3,
    errorHandler = defaultErrorHandler,
  } = options;

  // State
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const [pendingRequests, setPendingRequests] = useState(new Map());

  // Core messaging function
  const sendMessage = useCallback(
    async (message, tabId = null) => {
      const requestId = generateRequestId();

      try {
        setPendingRequests(
          (prev) =>
            new Map(prev.set(requestId, { message, timestamp: Date.now() }))
        );

        const response = tabId
          ? await chrome.tabs.sendMessage(tabId, message)
          : await chrome.runtime.sendMessage(message);

        return response;
      } catch (error) {
        errorHandler(error, message);
        throw error;
      } finally {
        setPendingRequests((prev) => {
          const updated = new Map(prev);
          updated.delete(requestId);
          return updated;
        });
      }
    },
    [timeout, retries, errorHandler]
  );

  // Tab management
  const createTab = useCallback(async (url, options = {}) => {
    return chrome.tabs.create({ url, ...options });
  }, []);

  // Storage helpers
  const getStorageData = useCallback(async (keys) => {
    return chrome.storage.local.get(keys);
  }, []);

  const setStorageData = useCallback(async (data) => {
    return chrome.storage.local.set(data);
  }, []);

  // Connection monitoring
  useEffect(() => {
    const handleConnect = () => setConnectionStatus("connected");
    const handleDisconnect = () => setConnectionStatus("disconnected");

    // Listen for connection events
    chrome.runtime.onConnect?.addListener(handleConnect);
    chrome.runtime.onDisconnect?.addListener(handleDisconnect);

    return () => {
      chrome.runtime.onConnect?.removeListener(handleConnect);
      chrome.runtime.onDisconnect?.removeListener(handleDisconnect);
    };
  }, []);

  return {
    // Core messaging
    sendMessage,

    // Tab management
    createTab,

    // Storage
    getStorageData,
    setStorageData,

    // State
    connectionStatus,
    isConnected: connectionStatus === "connected",
    pendingRequestsCount: pendingRequests.size,

    // Utilities
    clearPendingRequests: () => setPendingRequests(new Map()),
  };
};
```

### Integration Examples

**Before (timercomponent.jsx:35-44):**

```javascript
useEffect(() => {
  chrome.runtime.sendMessage(
    { type: "getLimits", id: state.LeetCodeID },
    function (response) {
      console.log("✅limits being sent to content script", response);
      let limit = response.limits.Time;
      setLimit(limit * 60);
      setTime(limit * 60);
    }
  );
}, [setLimit, setTime]);
```

**After:**

```javascript
const { sendMessage } = useChromeRuntime();

useEffect(() => {
  const fetchLimits = async () => {
    try {
      const response = await sendMessage({
        type: "getLimits",
        id: state.LeetCodeID,
      });
      const limit = response.limits.Time;
      setLimit(limit * 60);
      setTime(limit * 60);
    } catch (error) {
      console.error("Failed to fetch limits:", error);
    }
  };

  fetchLimits();
}, [sendMessage, state.LeetCodeID, setLimit, setTime]);
```

**Before (popup.jsx:20):**

```javascript
const openApp = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
};
```

**After:**

```javascript
const { createTab } = useChromeRuntime();

const openApp = () => {
  createTab(chrome.runtime.getURL("app.html"));
};
```

### Migration Priority

**High Priority (5+ usages):**

- `sendMessage` pattern - 15+ components
- Tab creation - 3+ components
- Storage access - 8+ components

**Medium Priority:**

- Connection monitoring - 2+ components
- Error handling standardization - All components

### Testing Strategy

```javascript
// Mock chrome.runtime for tests
const mockChromeRuntime = {
  sendMessage: jest.fn(),
  onConnect: { addListener: jest.fn(), removeListener: jest.fn() },
  onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
};

describe("useChromeRuntime", () => {
  beforeEach(() => {
    global.chrome = { runtime: mockChromeRuntime, tabs: { create: jest.fn() } };
  });

  it("should handle message sending", async () => {
    mockChromeRuntime.sendMessage.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useChromeRuntime());

    const response = await result.current.sendMessage({ type: "test" });
    expect(response).toEqual({ success: true });
  });
});
```

---

## useAsyncState Hook

### Purpose & Scope

Eliminate duplicated async loading patterns across 11+ components that manually manage loading, error, and data states.

### Current Usage Analysis

**Components with async loading patterns:**

- `probdetail.jsx:16-38` - Loading primers with useState(loading), useState(primers), useState(error)
- `FloatingHintButton.jsx` - Strategy data loading
- `CompactHintPanel.jsx` - Async data management
- `HintPanel.jsx` - Multi-step async operations
- `PrimerSection.jsx` - Tag primer loading
- `useStrategy.js:11-13` - Existing pattern in custom hook
- And 5+ more components...

### API Design

```javascript
export const useAsyncState = (asyncFn, dependencies = [], options = {}) => {
  const {
    initialData = null,
    immediate = true,
    onSuccess = null,
    onError = null,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  // State management
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastExecuted, setLastExecuted] = useState(null);
  const [retryAttempts, setRetryAttempts] = useState(0);

  // Stable reference for async function
  const stableAsyncFn = useCallback(asyncFn, dependencies);

  // Execute function with retry logic
  const execute = useCallback(
    async (...args) => {
      try {
        setLoading(true);
        setError(null);
        setLastExecuted(Date.now());

        const result = await stableAsyncFn(...args);
        setData(result);
        setRetryAttempts(0);

        if (onSuccess) onSuccess(result);
        return result;
      } catch (err) {
        setError(err);

        // Retry logic
        if (retryAttempts < retryCount) {
          setRetryAttempts((prev) => prev + 1);
          setTimeout(() => execute(...args), retryDelay);
          return;
        }

        if (onError) onError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [stableAsyncFn, onSuccess, onError, retryCount, retryDelay, retryAttempts]
  );

  // Auto-execute on dependency changes
  useEffect(() => {
    if (immediate && stableAsyncFn) {
      execute();
    }
  }, [execute, immediate]);

  // Manual retry
  const retry = useCallback(() => {
    setRetryAttempts(0);
    return execute();
  }, [execute]);

  return {
    // Data
    data,

    // State
    loading,
    error,

    // Computed
    hasData: data !== null && data !== undefined,
    hasError: error !== null,
    isRetrying: retryAttempts > 0,

    // Actions
    execute,
    retry,

    // Utilities
    reset: () => {
      setData(initialData);
      setError(null);
      setLoading(false);
      setRetryAttempts(0);
    },
    clearError: () => setError(null),

    // Metadata
    lastExecuted,
    retryAttempts,
  };
};
```

### Integration Examples

**Before (probdetail.jsx:13-38):**

```javascript
const [primers, setPrimers] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (problemTags && problemTags.length > 0) {
    loadPrimers();
  }
}, [problemTags]);

const loadPrimers = async () => {
  try {
    setLoading(true);
    const normalizedTags = problemTags.map((tag) => tag.toLowerCase().trim());
    const tagPrimers = await StrategyService.getTagPrimers(normalizedTags);
    setPrimers(tagPrimers);
  } catch (err) {
    console.error("Error loading primers:", err);
  } finally {
    setLoading(false);
  }
};
```

**After:**

```javascript
const { data: primers, loading } = useAsyncState(
  async () => {
    if (!problemTags?.length) return [];
    const normalizedTags = problemTags.map((tag) => tag.toLowerCase().trim());
    return StrategyService.getTagPrimers(normalizedTags);
  },
  [problemTags],
  {
    initialData: [],
    onError: (err) => console.error("Error loading primers:", err),
  }
);
```

**Before (useStrategy.js:40-60):**

```javascript
const loadStrategyData = async () => {
  try {
    setLoading(true);
    setError(null);

    const [contextualHints, tagPrimers] = await Promise.all([
      StrategyService.getContextualHints(problemTags),
      StrategyService.getTagPrimers(problemTags),
    ]);

    setHints(contextualHints);
    setPrimers(tagPrimers);
  } catch (err) {
    console.error("Error loading strategy data:", err);
    setError(err.message || "Failed to load strategy data");
  } finally {
    setLoading(false);
  }
};
```

**After:**

```javascript
const {
  data: strategyData,
  loading,
  error,
} = useAsyncState(
  async () => {
    const [contextualHints, tagPrimers] = await Promise.all([
      StrategyService.getContextualHints(problemTags),
      StrategyService.getTagPrimers(problemTags),
    ]);
    return { hints: contextualHints, primers: tagPrimers };
  },
  [problemTags],
  { retryCount: 2 }
);

const hints = strategyData?.hints || [];
const primers = strategyData?.primers || [];
```

### Advanced Usage Patterns

**Dependent Async Calls:**

```javascript
// Load user profile first, then user preferences
const { data: profile } = useAsyncState(() => UserService.getProfile(), []);

const { data: preferences } = useAsyncState(
  async () => (profile ? UserService.getPreferences(profile.id) : null),
  [profile],
  { immediate: !!profile }
);
```

**Conditional Loading:**

```javascript
const { data, loading, execute } = useAsyncState(
  () => DataService.fetchData(filters),
  [filters],
  { immediate: false }
);

// Execute only when button clicked
const handleLoadData = () => execute();
```

---

## useProblemNavigation Hook

### Purpose & Scope

Centralize navigation logic across problem flow components that manage route transitions, problem context, and navigation state.

### Current Usage Analysis

**Components with navigation patterns:**

- `probgen.jsx:1,21` - useLocation, useNavigate, problem selection flow
- `probdetail.jsx:2,22` - useLocation, useNavigate with problem context
- `main.jsx:3,11,21` - Complex navigation with menu state
- `probtime.jsx` - Timer-based navigation transitions
- `probsubmission.jsx` - Post-submission navigation
- Navigation context shared across 8+ problem components

### API Design

```javascript
export const useProblemNavigation = (options = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: locationState = {} } = location;

  const {
    basePath = "/problems",
    preserveState = true,
    onNavigationChange = null,
  } = options;

  // Navigation state
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);

  // Problem context from location state
  const problemContext = useMemo(
    () => ({
      problemId: locationState.LeetCodeID,
      problemTitle: locationState.problemTitle,
      problemTags: locationState.problemTags || [],
      difficulty: locationState.difficulty,
      sessionId: locationState.sessionId,
      previousRoute: locationState.previousRoute,
    }),
    [locationState]
  );

  // Navigation helpers
  const navigateToProblem = useCallback(
    (problemData, options = {}) => {
      const { replace = false, preserveContext = true } = options;

      setIsNavigating(true);

      const state = preserveContext
        ? {
            ...locationState,
            ...problemData,
            previousRoute: location.pathname,
          }
        : problemData;

      const targetPath = `${basePath}/${problemData.problemId || "details"}`;

      if (replace) {
        navigate(targetPath, { state, replace: true });
      } else {
        navigate(targetPath, { state });
      }

      // Track navigation history
      setNavigationHistory((prev) => [
        ...prev,
        {
          from: location.pathname,
          to: targetPath,
          timestamp: Date.now(),
          problemId: problemData.problemId,
        },
      ]);

      if (onNavigationChange) {
        onNavigationChange(targetPath, problemData);
      }

      setIsNavigating(false);
    },
    [
      navigate,
      location,
      locationState,
      basePath,
      preserveState,
      onNavigationChange,
    ]
  );

  const navigateToGenerator = useCallback(
    (sessionData = {}) => {
      setIsNavigating(true);

      const state = preserveState
        ? {
            ...locationState,
            ...sessionData,
            previousRoute: location.pathname,
          }
        : sessionData;

      navigate(`${basePath}/generator`, { state });
      setIsNavigating(false);
    },
    [navigate, location, locationState, basePath, preserveState]
  );

  const navigateToSubmission = useCallback(
    (submissionData = {}) => {
      setIsNavigating(true);

      const state = preserveState
        ? {
            ...locationState,
            ...submissionData,
            previousRoute: location.pathname,
          }
        : submissionData;

      navigate(`${basePath}/submission`, { state });
      setIsNavigating(false);
    },
    [navigate, location, locationState, basePath, preserveState]
  );

  const navigateBack = useCallback(
    (fallbackPath = "/") => {
      const previousRoute = locationState.previousRoute;

      if (previousRoute && previousRoute !== location.pathname) {
        navigate(previousRoute, { state: locationState });
      } else if (navigationHistory.length > 0) {
        const lastNav = navigationHistory[navigationHistory.length - 1];
        navigate(lastNav.from, { state: locationState });
      } else {
        navigate(fallbackPath);
      }
    },
    [navigate, location, locationState, navigationHistory]
  );

  // Route guards and utilities
  const canNavigateToTimer = useMemo(() => {
    return !!(problemContext.problemId && problemContext.sessionId);
  }, [problemContext]);

  const canSubmit = useMemo(() => {
    return !!(problemContext.problemId && problemContext.sessionId);
  }, [problemContext]);

  // URL utilities
  const getCurrentProblemUrl = useCallback(() => {
    if (!problemContext.problemId) return null;
    return `https://leetcode.com/problems/${problemContext.problemId}/`;
  }, [problemContext.problemId]);

  return {
    // Current context
    problemContext,
    currentPath: location.pathname,

    // Navigation actions
    navigateToProblem,
    navigateToGenerator,
    navigateToSubmission,
    navigateBack,

    // State
    isNavigating,
    navigationHistory,

    // Route guards
    canNavigateToTimer,
    canSubmit,

    // Utilities
    getCurrentProblemUrl,

    // Raw router hooks (for edge cases)
    navigate,
    location,
  };
};
```

### Integration Examples

**Before (probgen.jsx:1-2, 85+):**

```javascript
import { useLocation, useNavigate } from "react-router-dom";

const ProblemGenerator = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;

  const handleProblemClick = (problem) => {
    navigate("/problem-details", {
      state: {
        ...state,
        LeetCodeID: problem.id,
        problemTitle: problem.title,
        problemTags: problem.tags,
        difficulty: problem.difficulty
      }
    });
  };
```

**After:**

```javascript
const ProblemGenerator = () => {
  const { navigateToProblem, problemContext } = useProblemNavigation();

  const handleProblemClick = (problem) => {
    navigateToProblem({
      LeetCodeID: problem.id,
      problemTitle: problem.title,
      problemTags: problem.tags,
      difficulty: problem.difficulty
    });
  };
```

**Before (probdetail.jsx:2):**

```javascript
import { useLocation, useNavigate } from "react-router-dom";

const ProblemDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;

  const handleStartTimer = () => {
    if (state?.sessionId && state?.LeetCodeID) {
      navigate("/problem-timer", { state });
    }
  };
```

**After:**

```javascript
const ProblemDetail = () => {
  const { problemContext, canNavigateToTimer, navigateToProblem } = useProblemNavigation();

  const handleStartTimer = () => {
    if (canNavigateToTimer) {
      navigateToProblem(problemContext, {
        targetComponent: 'timer'
      });
    }
  };
```

### Migration Benefits

1. **Centralized Logic**: All navigation patterns in one place
2. **Type Safety**: Consistent problem context shape
3. **Route Guards**: Built-in validation for navigation actions
4. **State Management**: Automatic state preservation and cleanup
5. **History Tracking**: Built-in navigation history for analytics
6. **Error Prevention**: Guards against invalid navigation states

### Testing Strategy

```javascript
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: "/problems/generator",
  state: { sessionId: "123", LeetCodeID: "two-sum" },
};

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

describe("useProblemNavigation", () => {
  it("should navigate to problem with context", () => {
    const { result } = renderHook(() => useProblemNavigation());

    act(() => {
      result.current.navigateToProblem({
        problemId: "valid-parentheses",
        problemTitle: "Valid Parentheses",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/problems/valid-parentheses", {
      state: expect.objectContaining({
        problemId: "valid-parentheses",
        problemTitle: "Valid Parentheses",
        previousRoute: "/problems/generator",
      }),
    });
  });
});
```

---

## Implementation Priority & Timeline

### Phase 1: Core Hook Development (Week 1)

1. **useChromeRuntime** - Highest impact, 21+ components affected
2. **useAsyncState** - High reuse potential, 11+ components
3. **useProblemNavigation** - Complex but contained scope

### Phase 2: Component Migration (Week 2)

1. Start with highest-usage components
2. Update 3-5 components per hook
3. Run tests after each migration

### Phase 3: Cleanup & Optimization (Week 3)

1. Remove duplicated code
2. Add comprehensive tests
3. Performance optimization
4. Documentation updates

### Testing Strategy

- Unit tests for each hook
- Integration tests for hook combinations
- Component tests with mocked hooks
- E2E tests for critical user flows

### Success Metrics

- **Code Reduction**: 20-30% reduction in component complexity
- **Consistency**: Standardized patterns across components
- **Maintainability**: Centralized logic for common operations
- **Developer Experience**: Faster feature development
