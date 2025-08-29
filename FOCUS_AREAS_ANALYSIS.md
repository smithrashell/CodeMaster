# Focus Areas Architecture - Issues & Analysis

## Potential Code Smells & Bug Risks

### 🔴 High Priority Issues

#### 1. **Data Duplication & Synchronization Risk**
**Problem**: Multiple sources of truth for focus areas data
- `settings.focusAreas` (user preferences)
- `TagService.getCurrentTier().focusTags` (system recommendations)  
- `currentAllowedTags` (performance-limited)
- `enhancedFocusTags` (runtime merged)

**Risk**: Data can get out of sync, leading to inconsistent behavior
**Example**: User changes focus areas while session is running, but `enhancedFocusTags` still uses old data

**Mitigation**: 
- Consider caching strategy with TTL
- Add data validation at merge points
- Implement change notifications between components

#### 2. **Complex Parameter Passing Chain**
**Problem**: Multiple parameters passed through many function layers
```javascript
fetchAdditionalProblems(numProblems, excludeIds, userFocusAreas, currentAllowedTags)
```

**Risk**: Easy to miss parameters or pass wrong data
**Improvement**: Consider data transfer objects (DTOs)
```javascript
interface SessionContext {
  userFocusAreas: string[];
  currentAllowedTags: string[];
  performanceMetrics: PerformanceData;
  onboardingStatus: boolean;
}
```

#### 3. **Onboarding Logic Scattered**
**Problem**: Onboarding detection repeated in multiple places
- `sessions.js`: `sessionState.numSessionsCompleted < 3`
- `tagServices.js`: Same check in `getAvailableTagsForFocus()`
- `goals.jsx`: `isOnboarding` calculation

**Risk**: Logic gets out of sync, magic number (3) duplicated
**Solution**: Create centralized onboarding service
```javascript
class OnboardingService {
  static isOnboarding(sessionState) {
    return sessionState.numSessionsCompleted < ONBOARDING_SESSION_COUNT;
  }
}
```

### 🟡 Medium Priority Issues

#### 4. **Performance Expansion Complexity**
**Problem**: `calculateTagIndexProgression()` has complex business logic that's hard to test
- Multiple performance thresholds (0.75, 0.6, 0.8)
- Stagnation detection
- Time-based escape hatches

**Risk**: Edge cases in performance calculation could break tag expansion
**Improvement**: 
- Extract performance rules into configuration
- Add comprehensive unit tests for edge cases
- Consider performance calculation service

#### 5. **UI State Management**
**Problem**: UI components have complex state dependencies
- `FocusAreasSelector` manages custom mode, selected areas, availability data
- Goals page has multiple data sources with null checking

**Risk**: State inconsistencies, prop drilling
**Improvement**: Consider state management pattern (Context/Redux)

#### 6. **Error Handling Inconsistency**  
**Problem**: Different components handle errors differently
- Some return empty arrays `[]`
- Some return fallback values `["array"]`
- Some throw exceptions

**Risk**: Inconsistent user experience, potential crashes
**Solution**: Standardize error handling patterns

### 🟢 Low Priority Issues

#### 7. **Magic Numbers & Constants**
```javascript
const ONBOARDING_SESSION_COUNT = 3;
const MAX_FOCUS_TAGS = 3;
const MAX_USER_FOCUS_AREAS = 3;
const PRIMARY_PROBLEM_RATIO = 0.6; // 60% primary focus
```

#### 8. **Type Safety**
**Problem**: No TypeScript, potential runtime type errors
**Example**: `focusTags.slice()` could fail if `focusTags` is not an array

## Potential Bugs & Edge Cases

### Edge Case 1: User Selects Mastered Tags
**Scenario**: User selects focus areas that are already mastered
**Current Behavior**: Tags still get priority in `enhancedFocusTags`
**Risk**: User practices already-mastered content instead of learning new topics
**Solution**: Filter out mastered tags or show warnings in UI

### Edge Case 2: Performance Regression
**Scenario**: User performance drops significantly
**Current Behavior**: `tagCount` might decrease, but existing logic doesn't handle regression well
**Risk**: Jarring experience as focus suddenly narrows
**Solution**: Add minimum progression guarantees or gradual rollback

### Edge Case 3: Empty System Focus Tags
**Scenario**: `TagService.getCurrentTier()` returns empty `focusTags`
**Current Behavior**: Falls back to `["array"]` in some places, `[]` in others
**Risk**: Inconsistent fallback behavior
**Solution**: Centralized fallback strategy

### Edge Case 4: User Changes Focus Areas Mid-Session
**Scenario**: User updates focus areas while a session is active
**Current Behavior**: Session continues with old `enhancedFocusTags`
**Risk**: Session doesn't reflect user's latest preferences
**Solution**: Decide whether to allow mid-session changes or lock during session

## Architectural Recommendations

### 1. **Introduce Focus Context Service**
```javascript
class FocusContextService {
  static async buildFocusContext(userId) {
    const systemTags = await TagService.getCurrentTier();
    const userAreas = await StorageService.getSettings().focusAreas;
    const sessionState = await StorageService.getSessionState();
    
    return new FocusContext({
      systemTags: systemTags.focusTags,
      userAreas: userAreas || [],
      onboarding: this.isOnboarding(sessionState),
      performanceLevel: this.calculatePerformanceLevel(sessionState)
    });
  }
}
```

### 2. **Add Validation Layer**
```javascript
function validateFocusAreas(focusAreas, availableTags) {
  return focusAreas.filter(tag => 
    availableTags.includes(tag) && !isMastered(tag)
  );
}
```

### 3. **Configuration-Driven Rules**
```javascript
const FOCUS_CONFIG = {
  onboarding: {
    sessionCount: 3,
    maxTags: 1
  },
  performance: {
    expansion: {
      goodThreshold: 0.75,
      excellentThreshold: 0.8,
      stagnationDays: 14
    }
  },
  limits: {
    systemTags: 3,
    userAreas: 3,
    totalTags: 5
  }
};
```

### 4. **Event-Driven Updates**
Consider implementing focus area change events to keep UI in sync:
```javascript
EventBus.emit('focusAreasChanged', { userAreas, systemTags });
```

## Testing Strategy Recommendations

### Unit Tests Needed
- `calculateTagIndexProgression()` with all performance scenarios
- `enhancedFocusTags` creation with various user/system combinations  
- Onboarding detection edge cases
- Fallback behavior validation

### Integration Tests Needed
- End-to-end focus area flow from UI to problem selection
- Performance progression over multiple sessions
- Error scenarios (TagService failures, storage issues)

### User Acceptance Tests
- New user onboarding experience
- Experienced user with custom preferences
- Performance-based progression visibility

---

*Risk Assessment: Overall architecture is solid but has complexity that needs careful management*
*Priority: Address High Priority issues first, monitor for edge cases in production*