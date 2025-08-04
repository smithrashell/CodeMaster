# Frontend Architecture & Hook Patterns

## Overview

This Chrome extension frontend uses React 18 with a custom hook-based architecture for managing complex state, Chrome runtime interactions, and component logic. This document outlines patterns, conventions, and guidelines for maintaining scalable and consistent code.

## Architecture Summary

### Core Structure
- **Chrome Extension**: Multi-entry point extension (popup, content script, background, standalone app)
- **State Management**: IndexedDB with service layer for persistence
- **UI Framework**: Mantine UI with custom theme system
- **Build System**: Webpack with dev/prod configurations
- **Testing**: Jest with React Testing Library

### Key Directories
```
src/
├── shared/
│   ├── hooks/           # Custom React hooks
│   ├── services/        # Business logic & API layer
│   ├── components/      # Reusable UI components
│   ├── db/             # IndexedDB utilities
│   └── utils/          # Helper functions
├── content/            # LeetCode page integration
├── popup/              # Extension popup
└── app/                # Standalone dashboard
```

## Hook Pattern Guidelines

### When to Create Custom Hooks

#### ✅ **DO Extract When:**
1. **Logic Reused Across 2+ Components**
   - Async data fetching patterns
   - Chrome runtime communication
   - Complex state management

2. **Complex Stateful Logic**
   - Multiple related state variables
   - Side effects with cleanup
   - Event listener management

3. **Business Logic Isolation**
   - Domain-specific calculations
   - API integrations
   - Feature-specific state

4. **Testing & Maintainability Benefits**
   - Complex logic that needs isolated testing
   - Reducing component complexity
   - Standardizing behavior patterns

#### ❌ **DON'T Extract When:**
- Simple useState calls without additional logic
- One-off component-specific state
- Trivial calculations or transformations
- Tight coupling to specific component structure

### Hook Naming Conventions

```javascript
// Pattern: use[Domain][Action/State]
useStrategy()           // Domain-specific hooks
useChromeRuntime()      // Platform integration
useAsyncState()         // Generic patterns
useProblemNavigation()  // Feature-specific hooks
```

### Hook Structure Template

```javascript
import { useState, useEffect, useCallback } from 'react';

export const useCustomHook = (dependencies = {}) => {
  // 1. State declarations
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 2. Effects and side effects
  useEffect(() => {
    // Setup and cleanup logic
  }, [dependencies]);

  // 3. Event handlers and actions
  const handleAction = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Action implementation
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dependencies]);

  // 4. Return object with clear API
  return {
    // Data
    data,
    
    // State
    loading,
    error,
    
    // Computed values
    hasData: data !== null,
    
    // Actions
    handleAction,
    
    // Utilities
    clearError: () => setError(null)
  };
};
```

## Existing Hook Patterns

### useStrategy Hook
**Location**: `src/shared/hooks/useStrategy.js`

**Purpose**: Manages strategy data and contextual hints for problems

**Usage Pattern**:
```javascript
const {
  hints,
  primers,
  loading,
  error,
  hasHints,
  refreshStrategy,
  getTagStrategy
} = useStrategy(problemTags);
```

**Key Features**:
- Automatic data loading based on problem tags
- Parallel async operations with Promise.all
- Error boundary handling
- Manual refresh capability
- Computed values for UI state

## Chrome Extension Integration

### Chrome Runtime Patterns
Many components currently handle `chrome.runtime` manually:
```javascript
// Current pattern (to be refactored)
chrome.runtime.sendMessage({ type: "getLimits", id: state.LeetCodeID }, 
  function (response) {
    console.log("limits being sent", response);
    setLimit(response.limits.Time);
  }
);
```

### Recommended Chrome Hook Pattern
```javascript
// Future pattern with useChromeRuntime
const { sendMessage, loading, error } = useChromeRuntime();

const getLimits = async (id) => {
  const response = await sendMessage({ type: "getLimits", id });
  return response.limits;
};
```

## Component Integration Guidelines

### Hook Composition
```javascript
const ProblemComponent = ({ problemId }) => {
  // Domain-specific hooks
  const { hints, loading: strategyLoading } = useStrategy(problemTags);
  
  // Platform hooks  
  const { sendMessage } = useChromeRuntime();
  
  // Generic patterns
  const { data: limits, loading: limitsLoading } = useAsyncState(
    () => sendMessage({ type: "getLimits", id: problemId })
  );

  const loading = strategyLoading || limitsLoading;
  
  // Component logic...
};
```

### Provider Integration
Hook state can integrate with existing providers:
```javascript
const useThemeAwareHook = () => {
  const { theme } = useTheme(); // From existing provider
  // Hook logic that adapts to theme
};
```

## Testing Patterns

### Hook Testing Setup
```javascript
import { renderHook, act } from '@testing-library/react';
import { useCustomHook } from '../useCustomHook';

// Mock external dependencies
jest.mock('../services/apiService');

describe('useCustomHook', () => {
  it('should handle async operations', async () => {
    const { result } = renderHook(() => useCustomHook());
    
    expect(result.current.loading).toBe(false);
    
    await act(async () => {
      await result.current.handleAction();
    });
    
    expect(result.current.data).toBeDefined();
  });
});
```

### Component Integration Testing
```javascript
import { render, screen } from '@testing-library/react';
import { useCustomHook } from '../hooks/useCustomHook';

// Mock the hook
jest.mock('../hooks/useCustomHook');

const Component = () => {
  const { data, loading } = useCustomHook();
  return loading ? <div>Loading</div> : <div>{data}</div>;
};

test('component uses hook correctly', () => {
  useCustomHook.mockReturnValue({ data: 'test', loading: false });
  render(<Component />);
  expect(screen.getByText('test')).toBeInTheDocument();
});
```

## Performance Considerations

### Optimization Strategies
1. **Memoization**: Use `useCallback` and `useMemo` for expensive operations
2. **Dependency Arrays**: Keep effect dependencies minimal and stable
3. **State Batching**: Group related state updates
4. **Cleanup**: Always cleanup side effects (listeners, timers, subscriptions)

### Example Optimized Hook
```javascript
export const useOptimizedHook = (config) => {
  const memoizedConfig = useMemo(() => config, [config.key, config.value]);
  
  const expensiveCallback = useCallback(
    (data) => processData(data, memoizedConfig),
    [memoizedConfig]
  );
  
  useEffect(() => {
    const cleanup = setupEffect(expensiveCallback);
    return cleanup;
  }, [expensiveCallback]);
};
```

## Migration Strategy

### Phase 1: Documentation & Planning
- ✅ Document current patterns and guidelines
- ✅ Identify refactoring opportunities
- ⏳ Create hook implementation plans

### Phase 2: Core Hook Development
- ⏳ Implement `useChromeRuntime` hook
- ⏳ Implement `useAsyncState` hook  
- ⏳ Implement `useProblemNavigation` hook

### Phase 3: Component Refactoring
- ⏳ Update components to use new hooks
- ⏳ Remove duplicated logic
- ⏳ Add comprehensive tests

## File Organization

### Hook Files
```
src/shared/hooks/
├── index.js                 # Export all hooks
├── useStrategy.js          # Existing strategy hook
├── useChromeRuntime.js     # Chrome extension communication
├── useAsyncState.js        # Generic async state management
├── useProblemNavigation.js # Problem flow navigation
└── __tests__/              # Hook tests
    ├── useStrategy.test.js
    └── integration.test.js
```

### Import Patterns
```javascript
// Preferred: Named imports from index
import { useStrategy, useChromeRuntime } from '../shared/hooks';

// Acceptable: Direct imports for specific hooks
import { useStrategy } from '../shared/hooks/useStrategy';
```

## Contributing Guidelines

### Before Creating a New Hook
1. **Check Existing Patterns**: Review current hooks for similar functionality
2. **Consider Composition**: Can existing hooks be composed instead?
3. **Evaluate Scope**: Is this truly reusable or component-specific?
4. **Plan Testing**: How will this hook be tested in isolation?

### Code Review Checklist
- [ ] Hook follows naming conventions
- [ ] Proper dependency arrays in useEffect/useCallback
- [ ] Error handling and loading states
- [ ] Cleanup functions for side effects
- [ ] TypeScript definitions (if applicable)
- [ ] Unit tests with good coverage
- [ ] Documentation updates

---

*This document will evolve as hook patterns mature and new requirements emerge.*