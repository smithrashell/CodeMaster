# Component Refactoring Audit

## Overview

This document identifies specific refactoring opportunities discovered during the codebase analysis, prioritized by impact and complexity.

## Chrome Runtime Usage Audit

### High Priority Refactoring Targets

#### 1. timercomponent.jsx (Lines 35-44)

**Current Pattern:**

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

**Refactoring Impact:**

- Remove callback pattern complexity
- Add error handling
- Standardize async communication
- Enable testing with mocked chrome runtime

**Estimated LOC Reduction:** 6 lines → 3 lines core logic

#### 2. popup.jsx (Line 20)

**Current Pattern:**

```javascript
const openApp = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
};
```

**Refactoring Impact:**

- Standardize tab creation pattern
- Add error handling for failed tab creation
- Enable testing without chrome API mocking

**Estimated LOC Reduction:** 3 lines → 1 line

#### 3. Multiple Background Script Communications

**Components:** probgen.jsx, probdetail.jsx, probtime.jsx, probsubmission.jsx, settings.jsx, probstat.jsx

**Common Pattern:**

```javascript
chrome.runtime.sendMessage(
  { type: "someAction", data: payload },
  (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    // Handle response
  }
);
```

**Refactoring Impact:**

- Eliminate boilerplate error checking
- Consistent promise-based API
- Centralized timeout handling
- Standardized logging

**Estimated LOC Reduction:** 8-12 lines per component → 2-3 lines

## Async State Management Audit

### High Priority Refactoring Targets

#### 1. probdetail.jsx ExpandablePrimerSection (Lines 13-39)

**Current Pattern:**

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
    console.log("Loading primers for tags:", problemTags);
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

**Refactoring Impact:**

- Eliminate 26 lines of boilerplate
- Add automatic retry capability
- Standardize error handling
- Better loading state management

**Estimated LOC Reduction:** 26 lines → 8 lines

#### 2. useStrategy.js loadStrategyData (Lines 40-60)

**Current Pattern:**

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

**Refactoring Impact:**

- Simplify the existing custom hook
- Better separation of concerns
- Improved error messages
- Retry capability for failed requests

**Estimated LOC Reduction:** 20 lines → 12 lines

#### 3. Strategy Components Pattern

**Components:** FloatingHintButton.jsx, CompactHintPanel.jsx, HintPanel.jsx, PrimerSection.jsx

**Common Anti-Pattern:**

- Duplicated loading states across strategy components
- Inconsistent error handling
- Manual loading orchestration
- No retry mechanism

**Refactoring Impact:**

- Consistent loading UX across strategy system
- Centralized error handling
- Automatic retry for transient failures
- Reduced component complexity

**Estimated LOC Reduction:** 15-20 lines per component

## Navigation Pattern Audit

### High Priority Refactoring Targets

#### 1. probgen.jsx Navigation Logic

**Current Pattern:**

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
        difficulty: problem.difficulty,
        previousRoute: location.pathname
      }
    });
  };
```

**Refactoring Impact:**

- Remove manual state spreading
- Standardize problem context shape
- Add navigation guards
- Centralize route definitions

**Estimated LOC Reduction:** 12 lines → 4 lines

#### 2. main.jsx Complex Navigation (Lines 10-41)

**Current Pattern:**

```javascript
const Menubutton = ({ isAppOpen,setIsAppOpen,currPath }) => {
  const navigate = useNavigate();
  const isMainMenu = currPath === "/";

  const handleClick = () => {
    if (isAppOpen && !isMainMenu) {
      navigate("/"); // Go home
    } else {
      setIsAppOpen(!isAppOpen); // Toggle drawer
    }
  };

  const handleLabelChange = (isAppOpen, isMainMenu) => {
     if(isAppOpen && !isMainMenu){
      return "Go Home"
     } else if(isAppOpen && isMainMenu){
      return "Close Menu"
     } else if(!isAppOpen && isMainMenu){
      return "Open Menu"
     }
  };
```

**Refactoring Impact:**

- Simplify complex navigation logic
- Better state management for menu
- Consistent navigation patterns
- Improved accessibility

**Estimated LOC Reduction:** 20 lines → 8 lines

#### 3. Problem Flow Navigation

**Components:** probdetail.jsx, probtime.jsx, probsubmission.jsx

**Common Anti-Pattern:**

- Manual route validation
- Inconsistent state preservation
- No navigation history tracking
- Duplicated navigation guards

**Refactoring Impact:**

- Automatic route validation
- Consistent state management
- Navigation history for back buttons
- Centralized route guards

**Estimated LOC Reduction:** 10-15 lines per component

## Detailed Refactoring Priority Matrix

### Tier 1: Highest Impact, Lowest Risk

1. **popup.jsx chrome.tabs usage** - Simple, isolated, high test coverage potential
2. **timercomponent.jsx chrome.runtime patterns** - Clear boundaries, well-defined API
3. **Simple async state in strategy components** - Isolated components, existing patterns

### Tier 2: High Impact, Medium Risk

1. **probdetail.jsx ExpandablePrimerSection** - Complex component, multiple responsibilities
2. **useStrategy.js refactoring** - Core hook, affects multiple components
3. **probgen.jsx navigation logic** - Central to user flow

### Tier 3: Medium Impact, Higher Risk

1. **main.jsx complex navigation** - Tightly coupled to UI state
2. **Background script communication patterns** - Cross-component dependencies
3. **Multiple navigation components** - Requires coordinated changes

## Component-Specific Refactoring Plans

### timercomponent.jsx Refactoring

**Lines to Replace:** 35-44, potentially 47-63 (timer logic), 81+ (completion handling)

**Before:**

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
const { data: limits, loading } = useAsyncState(
  () => sendMessage({ type: "getLimits", id: state.LeetCodeID }),
  [state.LeetCodeID]
);

useEffect(() => {
  if (limits?.Time) {
    const limitInSeconds = limits.Time * 60;
    setLimit(limitInSeconds);
    setTime(limitInSeconds);
  }
}, [limits, setLimit, setTime]);
```

**Benefits:**

- Error handling included
- Loading state available
- Testable without chrome API
- Consistent with other async operations

### probdetail.jsx ExpandablePrimerSection Refactoring

**Lines to Replace:** 13-39

**Before:** 26 lines of manual async state management

**After:**

```javascript
const { data: primers = [], loading } = useAsyncState(
  async () => {
    if (!problemTags?.length) return [];
    const normalizedTags = problemTags.map((tag) => tag.toLowerCase().trim());
    return StrategyService.getTagPrimers(normalizedTags);
  },
  [problemTags],
  {
    onError: (err) => console.error("Error loading primers:", err),
    retryCount: 1,
  }
);
```

**Benefits:**

- Automatic retry on failure
- Consistent error logging
- Simplified component logic
- Better loading state handling

### probgen.jsx Navigation Refactoring

**Lines to Replace:** 1-2, 85+ (navigation logic)

**Before:**

```javascript
import { useLocation, useNavigate } from "react-router-dom";
// ... component logic
const handleProblemClick = (problem) => {
  navigate("/problem-details", {
    state: {
      ...state,
      LeetCodeID: problem.id,
      problemTitle: problem.title,
      problemTags: problem.tags,
      difficulty: problem.difficulty,
      previousRoute: location.pathname,
    },
  });
};
```

**After:**

```javascript
const { navigateToProblem } = useProblemNavigation();

const handleProblemClick = (problem) => {
  navigateToProblem({
    LeetCodeID: problem.id,
    problemTitle: problem.title,
    problemTags: problem.tags,
    difficulty: problem.difficulty,
  });
};
```

**Benefits:**

- Automatic state preservation
- Consistent problem context shape
- Built-in navigation guards
- Centralized route management

## Testing Strategy for Refactored Components

### Hook Mocking Strategy

```javascript
// Mock custom hooks for component tests
jest.mock("../../shared/hooks", () => ({
  useChromeRuntime: () => ({
    sendMessage: jest.fn().mockResolvedValue({ limits: { Time: 30 } }),
    createTab: jest.fn(),
    isConnected: true,
  }),
  useAsyncState: (asyncFn, deps, options) => ({
    data: null,
    loading: false,
    error: null,
    execute: jest.fn(),
  }),
  useProblemNavigation: () => ({
    navigateToProblem: jest.fn(),
    problemContext: { problemId: "test" },
    canNavigateToTimer: true,
  }),
}));
```

### Component Integration Tests

```javascript
describe("TimerComponent with hooks", () => {
  it("should load limits on mount", async () => {
    const mockSendMessage = jest
      .fn()
      .mockResolvedValue({ limits: { Time: 45 } });
    useChromeRuntime.mockReturnValue({ sendMessage: mockSendMessage });

    render(<TimerComponent />);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: "getLimits",
        id: expect.any(String),
      });
    });
  });
});
```

## Success Metrics

### Code Quality Metrics

- **Cyclomatic Complexity**: Reduce average complexity by 25%
- **Lines of Code**: 20-30% reduction in component files
- **Duplication**: Eliminate 90% of identified duplicate patterns

### Developer Experience Metrics

- **Test Coverage**: Increase from ~60% to 85%+
- **Component Maintainability**: Standardized patterns across all components
- **Development Speed**: Faster feature implementation with reusable hooks

### Technical Debt Metrics

- **Chrome API Direct Usage**: Reduce from 21 components to 0
- **Manual Async State**: Reduce from 11 components to 0
- **Navigation Boilerplate**: Reduce from 8 components to 0

## Migration Timeline

### Phase 1 (Week 1): Foundation

- Implement three core hooks
- Add comprehensive tests
- Create migration utilities

### Phase 2 (Week 2): High-Priority Components

- Refactor Tier 1 components (5 components)
- Update tests and documentation
- Validate patterns work correctly

### Phase 3 (Week 3): Broad Adoption

- Refactor Tier 2 and 3 components (15+ components)
- Performance optimization
- Final documentation updates

### Phase 4 (Ongoing): Maintenance

- Monitor for new duplication patterns
- Refine hooks based on usage feedback
- Expand patterns for new features
