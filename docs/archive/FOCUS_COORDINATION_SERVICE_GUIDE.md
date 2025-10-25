# Focus Coordination Service - Integration Guide

## 🎯 Quick Start Guide

This guide helps developers understand and work with the Focus Coordination Service in the CodeMaster learning system.

## 📋 When to Use the Coordination Service

### ✅ Use Coordination Service For:
- Getting focus tags for session generation
- Problem selection focus decisions
- UI display of focus information
- Any component that needs unified focus decisions

### ❌ Don't Use Coordination Service For:
- Direct tag mastery calculations (use TagService)
- Escape hatch detection (handled internally)
- Tag graduation triggers (handled internally) 
- Session state modifications unrelated to focus

## 🚀 Basic Usage

### Getting a Focus Decision
```javascript
import FocusCoordinationService from '../services/focusCoordinationService.js';

// Get unified focus decision
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);

console.log('Focus Decision:', {
  activeFocusTags: focusDecision.activeFocusTags,        // ["array", "hash-table"]
  systemRecommendation: focusDecision.systemRecommendation, // ["array", "hash-table", "string"]  
  userPreferences: focusDecision.userPreferences,        // ["array"]
  algorithmReasoning: focusDecision.algorithmReasoning,  // "Performance-based: 2 tags optimal"
  onboarding: focusDecision.onboarding,                  // false
  performanceLevel: focusDecision.performanceLevel       // "good"
});
```

### Session Generation Integration
```javascript
// In buildAdaptiveSessionSettings()
export async function buildAdaptiveSessionSettings() {
  // Get coordinated focus decision
  const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
  
  // Use coordinated decision for session focus
  let allowedTags = focusDecision.activeFocusTags;
  const onboarding = focusDecision.onboarding;
  
  // Continue with session length and problem count logic
  // ...
  
  return {
    sessionLength,
    numberOfNewProblems,
    currentAllowedTags: allowedTags,
    currentDifficultyCap: sessionState.currentDifficultyCap,
    userFocusAreas: focusDecision.userPreferences,
    sessionState,
  };
}
```

### Problem Selection Integration
```javascript
// In fetchAdditionalProblems()
export async function fetchAdditionalProblems(
  numNewProblems,
  excludeIds = new Set(),
  userFocusAreas = [],
  currentAllowedTags = [],
  userId = "session_state"
) {
  // Get coordinated focus decision
  const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
  
  // Use coordinated focus decision for enhanced focus tags
  const enhancedFocusTags = focusDecision.activeFocusTags;
  
  console.log("🎯 Using coordination service decision:", {
    activeFocusTags: enhancedFocusTags,
    reasoning: focusDecision.algorithmReasoning
  });
  
  // Continue with problem selection logic
  // ...
}
```

### UI Integration
```javascript
// In background.js - getGoalsData handler
case "getGoalsData":
  (async () => {
    try {
      // Get coordinated focus decision
      const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
      const settings = await StorageService.getSettings();
      
      // Use coordinated decision for UI data
      const result = await getGoalsData(request.options || {}, { 
        settings, 
        focusAreas: focusDecision.activeFocusTags,
        userFocusAreas: focusDecision.userPreferences,
        systemFocusTags: focusDecision.systemRecommendation,
        focusDecision // Pass full decision for UI enhancements
      });
      
      sendResponse({ result });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  })()
```

## 🏗️ Service Architecture

### Core Methods

#### `getFocusDecision(userId)`
**Main entry point** - Returns comprehensive focus decision
```javascript
{
  activeFocusTags: string[],      // What sessions actually use
  systemRecommendation: string[], // TagService suggestions
  userPreferences: string[],      // User-selected areas
  algorithmReasoning: string,     // Why algorithm made its choice
  onboarding: boolean,           // Whether user is in onboarding
  performanceLevel: string,      // "developing", "good", "excellent"
  escapeHatches: object[],       // Active escape hatch recommendations
  graduation: object,            // Tag graduation status
  availableTags: string[]        // All available tags in current tier
}
```

#### `calculateAlgorithmDecision(systemRec, sessionState, escapeHatches)`
**Algorithm-first logic** - Core learning algorithm decisions
- Applies onboarding restrictions (1 tag during first 3 sessions)
- Calculates optimal tag count based on performance
- Respects escape hatch modifications

#### `applyUserInfluence(algorithmDecision, userPreferences, availableTags)`
**User preference integration** - Secondary influence on algorithm decisions
- User can reorder tags but cannot override count
- Filters user preferences to valid choices only
- Algorithm maintains control over tag quantity

#### `updateSessionState(sessionState, focusDecision)`
**Safe state updates** - Avoids conflicts with other systems
- Only modifies focus-related fields
- Preserves other systems' ownership of session state
- Adds coordination timestamps and performance levels

### Integration Patterns

#### Pattern 1: Replace Complex Focus Logic
```javascript
// Before (scattered logic)
const { focusTags } = await TagService.getCurrentTier();
const userFocusAreas = settings.focusAreas || [];
const tagCount = calculateTagIndexProgression(...);
const currentAllowedTags = focusTags.slice(0, tagCount);
// Complex onboarding checks...

// After (coordinated)
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
const allowedTags = focusDecision.activeFocusTags;
```

#### Pattern 2: Enhance UI with Transparency
```javascript
// In React components
{focusDecision?.algorithmReasoning && (
  <Text size="xs" c="dimmed" fs="italic">
    📊 {focusDecision.algorithmReasoning}
  </Text>
)}

{focusDecision?.performanceLevel && (
  <Badge variant="light" color="blue" size="xs">
    {focusDecision.performanceLevel} performance
  </Badge>
)}
```

#### Pattern 3: Error Handling with Failsafe
```javascript
try {
  const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
  return focusDecision.activeFocusTags;
} catch (error) {
  console.error('Focus coordination failed:', error);
  // Failsafe returns single "array" tag
  const failsafe = FocusCoordinationService.getFailsafeDecision();
  return failsafe.activeFocusTags;
}
```

## ⚙️ Configuration

### Focus Configuration Constants
```javascript
const FOCUS_CONFIG = {
  onboarding: {
    sessionCount: 3,      // Sessions before graduation from onboarding
    maxTags: 1           // Maximum tags during onboarding
  },
  performance: {
    expansion: {
      goodThreshold: 0.75,      // Accuracy for tag expansion
      excellentThreshold: 0.8,  // Accuracy for significant expansion  
      stagnationDays: 14        // Days before stagnation fallback
    }
  },
  limits: {
    systemTags: 3,       // Maximum system recommendation tags
    userAreas: 3,        // Maximum user-selected areas
    totalTags: 5         // Maximum total coordinated tags
  }
};
```

## 🧪 Testing the Integration

### Unit Testing Focus Decisions
```javascript
describe('Focus Coordination Service', () => {
  test('should return failsafe decision on service failure', () => {
    const failsafe = FocusCoordinationService.getFailsafeDecision();
    
    expect(failsafe.activeFocusTags).toEqual(['array']);
    expect(failsafe.onboarding).toBe(true);
    expect(failsafe.algorithmReasoning).toContain('Failsafe');
  });
  
  test('should respect onboarding tag limits', async () => {
    // Mock onboarding user
    const mockSessionState = { numSessionsCompleted: 1 };
    
    const focusDecision = await FocusCoordinationService.getFocusDecision('test_user');
    
    expect(focusDecision.onboarding).toBe(true);
    expect(focusDecision.activeFocusTags.length).toBeLessThanOrEqual(1);
  });
});
```

### Integration Testing
```javascript
// Test session generation integration
test('session generation uses coordination service', async () => {
  const sessionSettings = await buildAdaptiveSessionSettings();
  
  expect(sessionSettings.currentAllowedTags).toBeDefined();
  expect(sessionSettings.userFocusAreas).toBeDefined();
  // Verify coordination service was used
});

// Test problem selection integration  
test('problem selection uses coordination service', async () => {
  const problems = await fetchAdditionalProblems(4, new Set(), [], [], 'test_user');
  
  expect(problems.length).toBeGreaterThan(0);
  // Verify problems match coordinated focus tags
});
```

## 🚨 Common Issues & Solutions

### Issue 1: Service Not Found
```javascript
// ❌ Wrong import
import { FocusCoordinationService } from '../services/focusCoordinationService.js';

// ✅ Correct import
import FocusCoordinationService from '../services/focusCoordinationService.js';
```

### Issue 2: Async/Await Issues
```javascript
// ❌ Missing await
const focusDecision = FocusCoordinationService.getFocusDecision(userId);

// ✅ Proper async handling
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
```

### Issue 3: Missing UserId Parameter
```javascript
// ❌ Missing userId
const focusDecision = await FocusCoordinationService.getFocusDecision();

// ✅ Provide userId (default: "session_state")
const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
```

### Issue 4: Null/Undefined Handling
```javascript
// ✅ Safe property access
const tags = focusDecision?.activeFocusTags || ['array'];
const reasoning = focusDecision?.algorithmReasoning || null;
```

## 🔄 Migration Guide

### From Scattered Logic to Coordination Service

#### Step 1: Replace TagService Calls
```javascript
// Before
const { focusTags } = await TagService.getCurrentTier();

// After  
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
const focusTags = focusDecision.systemRecommendation;
```

#### Step 2: Replace Complex Merging Logic
```javascript
// Before
const enhancedFocusTags = [...performanceFocusTags];
if (userFocusAreas.length > 0) {
  // Complex merging logic...
}

// After
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
const enhancedFocusTags = focusDecision.activeFocusTags;
```

#### Step 3: Update UI Components
```javascript
// Before
const systemTags = appState.systemFocusTags;
const userTags = appState.userFocusAreas;

// After (enhanced with coordination data)
const systemTags = appState?.learningPlan?.focus?.systemFocusTags;
const userTags = appState?.learningPlan?.focus?.userFocusAreas;
const activeTags = appState?.learningPlan?.focus?.activeFocusTags; // NEW
const reasoning = appState?.learningPlan?.focus?.algorithmReasoning; // NEW
```

## 📚 Best Practices

### 1. Use Coordination Service as Single Source of Truth
```javascript
// ✅ Good - Single coordinated call
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
const sessionTags = focusDecision.activeFocusTags;
const problemTags = focusDecision.activeFocusTags;

// ❌ Avoid - Multiple inconsistent calls
const sessionTags = await TagService.getCurrentTier().focusTags;
const problemTags = await someOtherFocusLogic();
```

### 2. Handle Errors Gracefully
```javascript
try {
  const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
  return focusDecision;
} catch (error) {
  console.error('Focus coordination failed:', error);
  return FocusCoordinationService.getFailsafeDecision();
}
```

### 3. Display Algorithm Transparency
```javascript
// Show users why decisions were made
{focusDecision.algorithmReasoning && (
  <Alert color="blue" variant="light">
    <Text size="sm">{focusDecision.algorithmReasoning}</Text>
  </Alert>
)}
```

### 4. Respect System Boundaries
```javascript
// ✅ Use coordination service for focus decisions
const focusDecision = await FocusCoordinationService.getFocusDecision(userId);

// ✅ Use specialized services for their domains
const escapeHatches = await EscapeHatchUtils.detect(...); // Still use directly
const graduation = await TagService.checkGraduation(...); // Still use directly
```

## 🔗 Related Resources

- **Architecture**: `FOCUS_AREAS_ARCHITECTURE.md`
- **Implementation**: `FOCUS_COORDINATION_SERVICE_IMPLEMENTATION.md`
- **Analysis**: `FOCUS_AREAS_ANALYSIS.md`
- **Source Code**: `src/shared/services/focusCoordinationService.js`

---

*Integration Guide v1.0*  
*Last Updated: 2025-08-24*  
*For questions: See architecture documentation or implementation summary*