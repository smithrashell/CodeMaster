# Focus Areas Refactor Plan - Unified Control & Reduced Complexity

## Core Problem
Control is scattered across multiple files with duplicated logic, creating synchronization risks while weakening algorithmic decision-making.

## Design Principle
**"Algorithm First, User Choice Second"** - Maintain algorithmic strength while providing transparent user input opportunities.

## Proposed Solution: Focus Coordination Service

### 1. Create Single Control Point
**File**: `src/shared/services/focusCoordinationService.js`
**Purpose**: Single source of truth for all focus area decisions

```javascript
// Centralized decision making
export class FocusCoordinationService {
  static async getFocusDecision(userId) {
    // 1. Get all inputs
    const systemRecommendation = await TagService.getCurrentTier();
    const userPreferences = await StorageService.getSettings().focusAreas;
    const sessionState = await StorageService.getSessionState(`sessionState_${userId}`);
    
    // 2. Apply algorithmic rules (ALGORITHM FIRST)
    const algorithmDecision = this.calculateAlgorithmDecision(
      systemRecommendation, sessionState
    );
    
    // 3. Apply user influence (USER SECOND)
    const finalDecision = this.applyUserInfluence(
      algorithmDecision, userPreferences
    );
    
    return {
      // What the session will actually use
      activeFocusTags: finalDecision.tags,
      
      // Transparency for UI
      systemRecommendation: systemRecommendation.focusTags,
      userPreferences: userPreferences || [],
      algorithmReasoning: finalDecision.reasoning,
      
      // Context
      onboarding: this.isOnboarding(sessionState),
      performanceLevel: finalDecision.performanceLevel
    };
  }
}
```

### 2. Algorithm-First Logic
```javascript
// STEP 1: Algorithm makes optimal decision
calculateAlgorithmDecision(systemRec, sessionState) {
  const performance = this.getPerformanceMetrics(sessionState);
  
  // Performance-based expansion (CORE ALGORITHM)
  const optimalTagCount = this.calculateOptimalTagCount(performance);
  const algorithmTags = systemRec.focusTags.slice(0, optimalTagCount);
  
  // Onboarding safety (CORE ALGORITHM)  
  if (this.isOnboarding(sessionState)) {
    return {
      tags: algorithmTags.slice(0, 1), // Algorithm enforces 1-tag limit
      reasoning: "Onboarding: Deep focus on single concept",
      performanceLevel: "onboarding"
    };
  }
  
  return {
    tags: algorithmTags,
    reasoning: `Performance-based: ${optimalTagCount} tags optimal`,
    performanceLevel: performance.level
  };
}

// STEP 2: User influence (doesn't override core decisions)
applyUserInfluence(algorithmDecision, userPreferences) {
  if (!userPreferences?.length) {
    return algorithmDecision; // Pure algorithm
  }
  
  // Filter user preferences to valid choices
  const validUserTags = userPreferences.filter(tag =>
    algorithmDecision.availableTags?.includes(tag)
  );
  
  // USER INFLUENCE: Reorder algorithm's decision, don't override count
  const reorderedTags = this.reorderByUserPreference(
    algorithmDecision.tags, 
    validUserTags
  );
  
  return {
    ...algorithmDecision,
    tags: reorderedTags,
    reasoning: `${algorithmDecision.reasoning} + User preference ordering`
  };
}
```

## Implementation Plan

### Phase 1: Create Coordination Service (No Breaking Changes)
**Files to Create**: 
- `src/shared/services/focusCoordinationService.js`

**Changes**:
1. Extract all onboarding constants to service
2. Extract performance calculation logic  
3. Create unified decision method
4. **No existing code changes yet** - just create service

### Phase 2: Update Session Generation (Single Point)
**Files to Modify**:
- `src/shared/db/sessions.js` - Replace scattered logic with service call

**Before (Scattered)**:
```javascript
const { focusTags } = await TagService.getCurrentTier();
const userFocusAreas = settings.focusAreas || [];
const onboarding = sessionState.numSessionsCompleted < 3;
const tagCount = calculateTagIndexProgression(...);
// Complex logic scattered throughout
```

**After (Unified)**:
```javascript  
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
const allowedTags = focusDecision.activeFocusTags;
```

### Phase 3: Update Problem Selection (Single Point)  
**Files to Modify**:
- `src/shared/db/problems.js` - Use coordinated decision

**Before (Complex Merging)**:
```javascript
const enhancedFocusTags = [...performanceFocusTags];
if (userFocusAreas.length > 0) {
  // Complex merging logic
}
```

**After (Simple)**:
```javascript
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
const enhancedFocusTags = focusDecision.activeFocusTags;
```

### Phase 4: Update UI (Transparency)
**Files to Modify**:
- `src/app/pages/progress/goals.jsx`
- `src/app/components/settings/FocusAreasSelector.jsx`

**Before (Multiple Data Sources)**:
```javascript
const systemTags = appState.systemFocusTags;
const userTags = appState.userFocusAreas; 
// Complex state management
```

**After (Single Source)**:
```javascript
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
// Display: systemRecommendation, userPreferences, activeFocusTags, reasoning
```

## Risk Mitigation Strategies

### 1. **Maintain Algorithm Strength**
- Algorithm ALWAYS determines tag count (never user)
- Algorithm ALWAYS enforces onboarding rules  
- User can only influence tag ordering within algorithm's choice

### 2. **Reduce Complexity**
- Single decision point eliminates synchronization issues
- Remove duplicate onboarding logic (centralized constants)
- Standardize error handling in one place

### 3. **Preserve User Agency** 
- User sees full transparency (system recommendation + reasoning)
- User preferences influence final ordering
- User can understand WHY algorithm made its choice

### 4. **Backward Compatibility**
- Phase rollout allows testing at each step
- Existing storage patterns unchanged
- UI improvements, not overhauls

## Benefits

### For Algorithm Integrity
- ✅ Single decision point prevents conflicting logic
- ✅ Performance-based expansion fully controlled  
- ✅ Onboarding safety can't be bypassed

### For User Experience
- ✅ Full transparency into system decisions
- ✅ Clear influence path (preference ordering)
- ✅ Consistent behavior across UI components

### For Development
- ✅ Single place to modify focus logic
- ✅ Easier testing (one service vs scattered logic)
- ✅ Reduced parameter passing complexity

## Constraints Compliance

✅ **No new npm packages** - Pure JavaScript service
✅ **No overhauls** - Incremental refactor maintaining functionality  
✅ **Focused fixes** - Addresses scattered control without scope creep
✅ **Existing tooling** - Uses current storage/service patterns
✅ **No index.js changes** - Direct service imports
✅ **No new DB stores** - Uses existing storage

## Implementation Order

1. **Week 1**: Create `FocusCoordinationService` (no breaking changes)
2. **Week 2**: Update session generation to use service
3. **Week 3**: Update problem selection to use service  
4. **Week 4**: Update UI to use unified data source
5. **Week 5**: Remove scattered logic, add comprehensive tests

## Success Metrics

- ✅ All focus decisions flow through single service
- ✅ Algorithm controls tag count, user influences ordering
- ✅ Zero synchronization bugs between components
- ✅ Consistent onboarding experience
- ✅ Full transparency in UI without weakening algorithm

---

*This plan maintains "Algorithm First, User Choice Second" while unifying control and reducing complexity.*