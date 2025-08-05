# Chrome API Usage Pattern Analysis

## Summary of Current State

**Total chrome.runtime.sendMessage calls found: 21 across 12 components**
**Total chrome.storage usage: 15+ instances across multiple files**
**Total chrome.tabs usage: 4+ instances**

## Pattern Analysis

### 1. chrome.runtime.sendMessage Patterns

#### Pattern A: Simple Request-Response (Most Common - 15 instances)
```javascript
// Pattern: Fire-and-forget or simple data fetch
useEffect(() => {
  chrome.runtime.sendMessage({ type: "someAction" }, (response) => {
    if (response) {
      setState(response.data);
    }
  });
}, []);
```

**Used in:**
- probgen.jsx: getCurrentSession
- settings.jsx: getSettings 
- ThemeToggle.jsx: getSettings (2 instances)
- timercomponent.jsx: getLimits
- main.jsx: onboardingUserIfNeeded
- probstat.jsx: getDashboardStatistics
- app.jsx: getDashboardStatistics

#### Pattern B: Complex Request with Error Handling (6 instances)
```javascript
// Pattern: More robust with error checks and multiple response paths
chrome.runtime.sendMessage(request, (response) => {
  if (chrome.runtime.lastError) {
    console.error("Error:", chrome.runtime.lastError.message);
    return;
  }
  
  if (response.error) {
    // Handle response error
  } else {
    // Handle success
  }
});
```

**Used in:**
- main.jsx: getProblemByDescription, getBackupFile
- probtime.jsx: addProblem (2 instances)
- probsubmission.jsx: addProblem
- probdetail.jsx: skipProblem

### 2. chrome.storage.local Patterns

#### Pattern C: Simple Get/Set Operations (8+ instances)
```javascript
// Pattern: Basic key-value storage operations
chrome.storage.local.get([key], (result) => {
  callback(result[key]);
});

chrome.storage.local.set({ key: value }, callback);
```

**Used in:**
- storageService.js: Centralized storage operations
- timerbutton.js: Store time data
- probtime.jsx: Store currentRoute
- Multiple services for session management

### 3. chrome.tabs Operations (4 instances)
```javascript
// Pattern: Tab creation and messaging
chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
chrome.tabs.query({ active: true, currentWindow: true }, callback);
```

**Used in:**
- popup.jsx: Open app tab
- navigationService.js: Tab messaging

## Duplication Analysis

### High Duplication - Settings Requests
**Frequency: 4 components**
**Pattern:** All request settings with `{ type: "getSettings" }`
- ThemeToggle.jsx (2 times)
- settings.jsx 
- main.jsx (commented out)

**Pain Points:**
- Same boilerplate repeated
- No consistent error handling
- Different response handling patterns

### Medium Duplication - Dashboard Statistics
**Frequency: 2 components**
**Pattern:** All request dashboard data with `{ type: "getDashboardStatistics" }`
- probstat.jsx
- app.jsx

### Medium Duplication - Problem Operations
**Frequency: 3 components**
**Pattern:** All use `addProblem` type requests
- probtime.jsx (2 instances)
- probsubmission.jsx

**Pain Points:**
- Similar request structure but different response handling
- Repeated error handling patterns
- Different loading state management

### Low Duplication - Session Operations
**Frequency: 2 components**
**Pattern:** getCurrentSession requests
- probgen.jsx
- (Used indirectly in other components)

## Current Pain Points Identified

### 1. **Inconsistent Error Handling**
- Some components check `chrome.runtime.lastError`
- Some check `response.error`
- Some do both, some do neither
- No standardized error handling pattern

### 2. **Repeated Boilerplate**
- Same useEffect + chrome.runtime.sendMessage pattern
- Similar state management for loading/error states
- Repeated response validation logic

### 3. **No Loading States**
- Most components don't show loading indicators
- No consistent loading state management
- Users don't know when requests are in progress

### 4. **No Request Deduplication**
- Multiple components may request same data
- No caching or request deduplication
- Potential for race conditions

## Recommended Custom Hooks (In Priority Order)

### 1. **useChromeMessage** (Highest Impact)
**Addresses:** 15+ instances of basic request-response pattern
**Benefits:** Standardizes error handling, adds loading states, reduces boilerplate

### 2. **useSettings** (Medium Impact) 
**Addresses:** 4 instances of settings requests
**Benefits:** Caches settings, provides consistent API, handles theme updates

### 3. **useDashboardStats** (Lower Impact)
**Addresses:** 2 instances of dashboard statistics
**Benefits:** Caches expensive statistics, provides loading states

## Next Steps

1. Implement `useChromeMessage` hook first (highest impact)
2. Test with one component (settings.jsx recommended)
3. Verify no performance regressions
4. Document usage patterns
5. Gradually migrate other components if successful