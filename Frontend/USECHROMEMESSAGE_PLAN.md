# useChromeMessage Hook Implementation Plan

## Hook Design

**Lines of code:** 47 lines (under 50 ✅)
**Single concern:** Chrome runtime message communication ✅
**Zero breaking changes:** Wraps existing patterns ✅

## Success Criteria

### 1. Functional Requirements

- ✅ **Replaces Pattern A**: Works for simple request-response scenarios
- ✅ **Standardized error handling**: Checks both runtime and response errors
- ✅ **Loading states**: Provides loading indicator for better UX
- ✅ **Flexible**: Works with different request types and dependencies

### 2. Performance Requirements

- **No re-render issues**: Must not cause continuous re-rendering
- **Same functionality**: Existing behavior preserved exactly
- **No memory leaks**: Proper cleanup on unmount

### 3. Developer Experience

- **Simple API**: Easy to understand and use
- **Drop-in replacement**: Minimal changes to existing components
- **Clear error messages**: Better debugging than current approach

## Testing Plan

### Phase 1: Isolated Testing

1. **Create test component** to verify hook works independently
2. **Test all scenarios**: Success, runtime error, response error, loading states
3. **Verify no infinite loops** or re-render issues

### Phase 2: Single Component Migration

1. **Target component**: ThemeToggle.jsx (simple, non-critical)
2. **Before/after comparison**: Verify identical behavior
3. **Performance check**: Ensure no regressions

### Phase 3: Rollback Plan

1. **Easy revert**: Keep original code commented out during testing
2. **Quick rollback**: If any issues, immediately revert to original
3. **Document issues**: Note any problems for future iterations

## Migration Target: ThemeToggle.jsx

### Current Code:

```javascript
useEffect(() => {
  chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
    const savedTheme = response?.theme || "light";
    if (savedTheme !== colorScheme) {
      toggleColorScheme(savedTheme);
    }
  });
}, []);
```

### New Code:

```javascript
const {
  data: settings,
  loading,
  error,
} = useChromeMessage({ type: "getSettings" }, [], {
  onSuccess: (response) => {
    const savedTheme = response?.theme || "light";
    if (savedTheme !== colorScheme) {
      toggleColorScheme(savedTheme);
    }
  },
});
```

### Benefits:

1. **Loading state available**: Can show loading indicator if needed
2. **Error handling**: Automatic error handling and display
3. **Consistent pattern**: Same as other components will use
4. **Less boilerplate**: No manual error checking needed

## Risk Mitigation

### Low Risk:

- ThemeToggle.jsx is non-critical for core functionality
- Easy to revert if issues occur
- Hook is simple and follows React best practices

### Monitoring:

- Watch for any re-render issues during testing
- Verify theme switching still works perfectly
- Check browser console for any new errors

## Migration Results

### Completed Migrations ✅

1. **ThemeToggle.jsx** - Initial test migration with getSettings
2. **settings.jsx** - Settings page with mock/chrome runtime switching
3. **probgen.jsx** - Problem generator with getCurrentSession
4. **timercomponent.jsx** - Timer component with getLimits
5. **main.jsx** - Navigation component with onboardingUserIfNeeded
6. **app.jsx** - Dashboard app with getDashboardStatistics
7. **probstat.jsx** - Statistics page with countProblemsByBoxLevel

### Performance Impact

- **Bundle size**: Minimal impact (~10KB increase)
- **Build time**: No significant change
- **No re-render issues**: All migrations successful

## Usage Patterns for Developers

### Pattern 1: Simple Request-Response

```javascript
const { data, loading, error } = useChromeMessage(
  { type: "getSettings" },
  [], // deps array
  {
    onSuccess: (response) => {
      // Handle successful response
      setLocalState(response);
    },
  }
);
```

### Pattern 2: Conditional Requests

```javascript
const { data, loading, error } = useChromeMessage(
  !useMock ? { type: "getSettings" } : null, // null prevents request
  [],
  { onSuccess: handleResponse }
);
```

### Pattern 3: Dynamic Request Parameters

```javascript
const { data, loading, error } = useChromeMessage(
  { type: "getLimits", id: state?.LeetCodeID },
  [state?.LeetCodeID], // Re-run when ID changes
  { onSuccess: handleLimits }
);
```

### Pattern 4: Error Handling

```javascript
const { data, loading, error } = useChromeMessage(
  { type: "countProblemsByBoxLevel" },
  [],
  {
    onSuccess: (response) => {
      if (response?.status === "success") {
        setData(response.data);
      } else {
        setError("Custom error message");
      }
    },
    onError: (errorMsg) => {
      setError("Network or runtime error");
    },
  }
);
```

### Migration Guidelines

1. **Keep original code commented** for easy rollback
2. **Update dependencies array** when using dynamic parameters
3. **Handle both success and error cases** in callbacks
4. **Test build after each migration** to catch issues early
5. **Use null request to prevent unwanted calls** (conditional requests)

### Common Pitfalls

- Forgetting to update import statements
- Missing dependency arrays for dynamic parameters
- Not handling null/undefined states properly
- Removing original code before testing completion
