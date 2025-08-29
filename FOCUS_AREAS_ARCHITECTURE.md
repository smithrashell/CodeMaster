# Focus Areas Architecture Documentation

## Overview
This document describes the complete flow of focus areas and system tags throughout the CodeMaster learning system, from generation to problem selection. **Updated to reflect the Focus Coordination Service integration and safe integration approach implemented in August 2024.**

## Architecture Evolution

### Previous Architecture (Pre-August 2024)
- Scattered focus logic across multiple files
- Complex parameter passing chains
- Potential synchronization issues between components
- Multiple sources of truth for focus decisions

### Current Architecture (Post-August 2024) 
- **Focus Coordination Service** - Single source of truth for focus decisions
- **Safe Integration Approach** - Integrates with existing systems without replacing them
- **Algorithm First, User Choice Second** - Maintains algorithmic strength with user transparency
- **Unified Decision Flow** - All focus decisions coordinated through single service

## System Components

### 1. TagService (System Intelligence)
**File**: `src/shared/services/tagServices.js`
**Purpose**: Generates intelligent focus tags based on user performance and mastery data

**Key Functions**:
- `getCurrentTier()` - Returns current learning tier and system-generated focus tags
- `getIntelligentFocusTags()` - Selects 3 optimal tags based on learning efficiency
- `getAvailableTagsForFocus()` - Provides tags for UI selection with onboarding restrictions

**Data Generated**:
```javascript
{
  focusTags: ["array", "hash-table", "string"], // Max 3 system-selected tags
  allTagsInCurrentTier: [...], // All available tags in current tier
  masteryData: [...] // Performance data for each tag
}
```

### 2. User Focus Areas (User Preferences)
**Storage**: `settings.focusAreas` via Chrome Storage API
**Purpose**: User-selected preferences that influence problem selection
**Limit**: 1-3 tags (UI enforced)

### 3. **Focus Coordination Service** (NEW - Central Control)
**File**: `src/shared/services/focusCoordinationService.js`
**Purpose**: Single source of truth for all focus area decisions with safe integration approach

**Key Functions**:
- `getFocusDecision(userId)` - Main entry point for unified focus decisions
- `calculateAlgorithmDecision()` - Algorithm-first decision making
- `applyUserInfluence()` - Applies user preferences as secondary influence
- `updateSessionState()` - Updates session state without conflicts

**Integration Points**:
- **Escape Hatch System**: Respects escape hatch decisions before making focus choices
- **Tag Graduation**: Checks and handles graduated tags automatically
- **Session State**: Only modifies focus-related fields to avoid conflicts with other systems

**Decision Flow**:
```javascript
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
// Returns:
{
  activeFocusTags: ["array", "hash-table"], // What sessions actually use
  systemRecommendation: ["array", "hash-table", "string"], // TagService suggestions
  userPreferences: ["array"], // User's selected focus areas
  algorithmReasoning: "Performance-based: 2 tags optimal for current skill level",
  onboarding: false,
  performanceLevel: "good",
  escapeHatches: [...], // Active escape hatch recommendations
  availableTags: [...] // All available tags in current tier
}
```

### 4. Session Generation (Performance Control)
**File**: `src/shared/db/sessions.js` - `buildAdaptiveSessionSettings()`
**Purpose**: Controls how many focus tags are used based on performance

**Updated Logic Flow (Post-Coordination Service)**:
```javascript
// 1. Get coordinated focus decision (integrates all systems)
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);

// 2. Use coordinated decision for session focus
let allowedTags = focusDecision.activeFocusTags;
const onboarding = focusDecision.onboarding;

console.log(`🎯 Focus Coordination Service decision:`, {
  activeFocusTags: allowedTags,
  reasoning: focusDecision.algorithmReasoning,
  onboarding: focusDecision.onboarding,
  performanceLevel: focusDecision.performanceLevel
});

// 3. Session length and problem count logic continues as before
// 4. Focus tags are now handled by coordination service
```

**Previous Logic Flow (Pre-Coordination Service)**:
```javascript
// 1. Get system focus tags
const { focusTags } = await TagService.getCurrentTier();

// 2. Get user preferences  
const userFocusAreas = settings.focusAreas || [];

// 3. Performance-based expansion
const tagCount = calculateTagIndexProgression(accuracy, efficiency, ...);
// tagCount starts at 1, can grow to focusTags.length (max 5) based on performance

// 4. Apply performance limits
const currentAllowedTags = focusTags.slice(0, tagCount);

// 5. Apply onboarding restrictions
if (onboarding) {
  if (userFocusAreas.length > 0) {
    allowedTags = userFocusAreas.slice(0, 1); // User choice, limited to 1
  } else {
    allowedTags = currentAllowedTags.slice(0, 1); // System choice, limited to 1
  }
} else {
  // Post-onboarding: use performance-expanded tags
  allowedTags = currentAllowedTags;
}
```

**Performance Expansion Rules**:
- Start: 1 tag
- Good performance (75% accuracy OR 60% efficiency): +1 tag
- Excellent performance OR stagnation: +2 tags  
- Maximum: `focusTags.length` (typically 5)

### 5. Problem Selection (Enhanced Focus Tags)
**File**: `src/shared/db/problems.js` - `fetchAdditionalProblems()`
**Purpose**: Uses coordinated focus decision for consistent problem selection

**Updated Enhanced Focus Tags Creation (Post-Coordination Service)**:
```javascript
// 1. Get coordinated focus decision (integrates all systems)
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);

// 2. Use coordinated focus decision for enhanced focus tags
const enhancedFocusTags = focusDecision.activeFocusTags;

console.log("🎯 Focus Coordination Service decision:", {
  activeFocusTags: enhancedFocusTags,
  reasoning: focusDecision.algorithmReasoning,
  userPreferences: focusDecision.userPreferences,
  systemRecommendation: focusDecision.systemRecommendation
});
```

**Previous Enhanced Focus Tags Creation (Pre-Coordination Service)**:
```javascript
// 1. Use performance-limited tags from session generation
const performanceFocusTags = currentAllowedTags.length > 0 
  ? currentAllowedTags 
  : focusTags;

// 2. Start with performance-limited system tags
const enhancedFocusTags = [...performanceFocusTags];

// 3. Prioritize user selections
if (userFocusAreas.length > 0) {
  const userSelectedTags = userFocusAreas.filter(tag => 
    allTagsInCurrentTier.includes(tag)
  );
  const systemTags = performanceFocusTags.filter(tag => 
    !userSelectedTags.includes(tag)
  );
  // Final priority: [userTags, systemTags]
  enhancedFocusTags = [...userSelectedTags, ...systemTags];
}
```

**Problem Distribution**:
- 60% of problems: `enhancedFocusTags[0]` (user's first choice OR system's top pick)
- 40% of problems: `enhancedFocusTags[1]` (user's second choice OR system's second pick)

### 6. UI Display (Enhanced Transparency)
**Files**: 
- `src/app/pages/progress/goals.jsx`
- `src/app/components/settings/FocusAreasSelector.jsx`

**Updated Data Flow to UI (Post-Coordination Service)**:
```javascript
// Background script uses coordination service
const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");

const result = await getGoalsData(request.options || {}, { 
  settings, 
  focusAreas: focusDecision.activeFocusTags,
  userFocusAreas: focusDecision.userPreferences,
  systemFocusTags: focusDecision.systemRecommendation,
  focusDecision // Pass full decision for additional context
});
```

**Enhanced UI Sections (Post-Coordination Service)**:
1. **System Recommendations**: Always visible, cyan badges - TagService suggestions
2. **User Focus Areas**: User selections, violet badges - User preferences  
3. **Active Session Focus**: **NEW** - Teal badges showing coordination service decision
4. **Algorithm Reasoning**: **NEW** - Displays why algorithm made its choice
5. **Performance Indicators**: **NEW** - Shows onboarding status and performance level

**Previous Data Flow to UI (Pre-Coordination Service)**:
```javascript
// Background script passes both separately
const result = await getGoalsData(request.options || {}, { 
  settings, 
  focusAreas, // Effective focus areas (for backward compatibility)
  userFocusAreas, // User selections
  systemFocusTags // System recommendations
});
```

## Complete Data Flow

### Current Flow (Post-Coordination Service)
```
1. FocusCoordinationService.getFocusDecision(userId)
   ↓ integrates TagService + EscapeHatch + TagGraduation + User Preferences
   ↓ returns unified focus decision with transparency data
   
2. buildAdaptiveSessionSettings()
   ↓ uses focusDecision.activeFocusTags for session focus
   ↓ applies session length/problem count logic
   
3. fetchAdditionalProblems()
   ↓ uses focusDecision.activeFocusTags for enhancedFocusTags
   ↓ selects problems: 60% from [0], 40% from [1]
   
4. Background script (getGoalsData)
   ↓ passes full focusDecision to UI
   
5. UI displays:
   - System recommendations (cyan)
   - User preferences (violet)  
   - Active session focus (teal) with algorithm reasoning
```

### Previous Flow (Pre-Coordination Service)
```
1. TagService.getCurrentTier()
   ↓ generates focusTags (max 3)
   
2. User sets focusAreas (0-3 tags)
   ↓ stored in settings
   
3. buildAdaptiveSessionSettings()
   ↓ calculates performance-based tagCount
   ↓ creates currentAllowedTags = focusTags.slice(0, tagCount)
   ↓ applies onboarding restrictions
   
4. fetchAdditionalProblems(currentAllowedTags, userFocusAreas)
   ↓ merges into enhancedFocusTags with user priority
   ↓ selects problems: 60% from [0], 40% from [1]
   
5. UI displays both userFocusAreas and systemFocusTags separately
```

## Key Integration Points

### Session State Coordination
- **Onboarding Detection**: `sessionState.numSessionsCompleted < 3`
- **Performance Tracking**: `sessionState.tagIndex` tracks progression
- **Tag Expansion**: Based on `accuracy` and `efficiencyScore`

### Data Consistency Points
- Background script: Gets both user and system tags
- Dashboard service: Passes both to UI components
- Problem selection: Merges both with user priority
- UI: Displays both with clear distinction

## Example Scenarios

### Scenario 1: New User (Onboarding)
```
1. System generates: ["array", "hash-table", "string"]
2. User hasn't set preferences: userFocusAreas = []
3. Performance limits: tagCount = 1
4. Session uses: ["array"] (system's top pick, limited to 1)
5. UI shows: System=["array", "hash-table", "string"], User=[]
```

### Scenario 2: Experienced User with Preferences
```
1. System generates: ["dynamic-programming", "graph", "tree"]  
2. User set preferences: ["graph", "binary-search"]
3. Performance allows: tagCount = 3
4. Enhanced tags: ["graph", "binary-search", "dynamic-programming", "tree"]
   (user preferences first, then system tags not in user list)
5. Problem selection: 60% graph, 40% binary-search
6. UI shows: System=["dynamic-programming", "graph", "tree"], User=["graph", "binary-search"]
```

### Scenario 3: Performance Progression
```
Week 1: tagCount=1 → uses 1 tag
Week 2: Good performance → tagCount=2 → uses 2 tags  
Week 4: Excellent performance → tagCount=4 → uses 4 tags
Week 6: Stagnation fallback → tagCount=5 → uses all 5 tags
```

## State Storage

### Chrome Storage (Persistent)
- `settings.focusAreas` - User focus area preferences
- `sessionState_${userId}.numSessionsCompleted` - Onboarding progress
- `sessionState_${userId}.tagIndex` - Performance progression

### IndexedDB (Persistent)
- `tag_mastery` - Performance data for tag expansion decisions
- `tag_relationships` - Used by TagService for intelligent selection

### Runtime State (Temporary)
- `enhancedFocusTags` - Merged user+system tags for current session
- `currentAllowedTags` - Performance-limited system tags

## Benefits of Focus Coordination Service Integration

### For Algorithm Integrity
- ✅ **Single Decision Point**: Prevents conflicting logic across components
- ✅ **Performance Expansion Preserved**: Full integration with existing tag expansion logic  
- ✅ **Onboarding Safety**: Cannot be bypassed, enforced at coordination level
- ✅ **Escape Hatch Compatibility**: Respects escape hatch decisions before making choices

### For User Experience  
- ✅ **Full Transparency**: Users see exactly what their sessions will focus on
- ✅ **Algorithm Reasoning**: Clear explanation of why decisions were made
- ✅ **Consistent Behavior**: Unified decision flow eliminates UI inconsistencies
- ✅ **Enhanced UI**: New "Active Session Focus" section with performance indicators

### For Development
- ✅ **Centralized Logic**: Single place to modify focus behavior
- ✅ **Easier Testing**: Test coordination service instead of scattered logic
- ✅ **Reduced Complexity**: Simplified parameter passing chains
- ✅ **Safe Integration**: No breaking changes to existing systems

### System Coordination Benefits
- ✅ **Escape Hatch Integration**: Automatic detection and application
- ✅ **Tag Graduation Handling**: Automatic cleanup of graduated focus areas  
- ✅ **State Conflict Prevention**: Only modifies focus-related session state fields
- ✅ **Backward Compatibility**: All existing systems continue to work independently

## Error Handling & Fallbacks

### Coordination Service Failures
- **Failsafe Decision**: Returns safe fallback with single "array" tag
- **Graceful Degradation**: UI shows basic focus information if service fails
- **System Independence**: Other systems continue working if coordination service fails

### TagService Failures
- Fallback to `["array"]` if no focus tags available
- Conservative onboarding assumption in error cases

### User Data Missing
- Fall back to system focus tags if no user preferences
- Graceful degradation in UI (shows "No focus areas selected")

### Performance Data Missing  
- Default to `tagCount = 1` for safety
- Maintain onboarding restrictions even without performance data

## Recent Updates

### August 2024 - Focus Coordination Service Integration
- **Added**: Focus Coordination Service (`src/shared/services/focusCoordinationService.js`)
- **Updated**: Session generation to use coordination service
- **Updated**: Problem selection to use coordination service  
- **Enhanced**: UI with active session focus display and algorithm reasoning
- **Fixed**: CustomMultiSelect hover effect sticking issue
- **Approach**: Safe integration - existing systems preserved, coordination layer added

---

*Last Updated: 2025-08-24*
*Related Files: focusCoordinationService.js, tagServices.js, sessions.js, problems.js, goals.jsx, FocusAreasSelector.jsx, CustomMultiSelect.jsx*