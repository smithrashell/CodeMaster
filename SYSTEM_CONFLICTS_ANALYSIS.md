# System Conflicts Analysis - Focus Coordination Plan

## 🔴 **HIGH RISK CONFLICTS**

### 1. **Escape Hatch System** 
**File**: `src/shared/utils/escapeHatchUtils.js`
**Conflict**: Directly modifies session state and performance thresholds that our coordination service would centralize

**Current Logic**:
- Detects stagnation (10+ sessions, 15+ failed attempts, 2+ weeks)
- Lowers success rate thresholds (80% → 60%)
- Modifies difficulty progression

**Risk**: Our coordination service might override escape hatch decisions or vice versa

**Mitigation**: Coordination service MUST check escape hatch status before making decisions
```javascript
// In FocusCoordinationService
const escapeHatches = await EscapeHatchUtils.detectApplicableEscapeHatches(
  sessionState, masteryData, tierTags
);
// Apply escape hatch modifications to algorithm decision
```

### 2. **Tag Graduation System**
**Functions**: `checkFocusAreasGraduation()`, `graduateFocusAreas()`
**Conflict**: Automatically updates user focus areas when tags are mastered

**Risk**: Coordination service might use outdated user preferences if graduation happens mid-session

**Mitigation**: Coordination service should check for graduated tags and handle cleanup
```javascript
// Check if user focus areas need graduation update
const graduationStatus = await TagService.checkFocusAreasGraduation();
if (graduationStatus.needsUpdate) {
  // Handle graduated tags before building focus decision
}
```

### 3. **Session State Management**
**Multiple Files**: sessions.js, tagServices.js, escapeHatchUtils.js
**Conflict**: Multiple systems modify `sessionState.tagIndex`, `numSessionsCompleted`, `escapeHatches`

**Risk**: Race conditions, inconsistent state updates

**Current State Structure**:
```javascript
sessionState = {
  numSessionsCompleted: 0,     // Used by onboarding detection
  tagIndex: 0,                 // Used by performance progression  
  escapeHatches: {...},        // Used by escape hatch system
  lastPerformance: {...}       // Used by all systems
}
```

**Mitigation**: Coordination service should be the ONLY system modifying focus-related session state

## 🟡 **MEDIUM RISK CONFLICTS**

### 4. **Dashboard Service Integration**
**File**: `src/app/services/dashboardService.js`
**Conflict**: Currently calls TagService directly for system focus tags

**Risk**: Dashboard might show stale data if coordination service caches decisions

**Solution**: Dashboard should call coordination service instead of TagService directly

### 5. **Background Script Handlers**
**File**: `public/background.js`
**Conflict**: Multiple handlers (`getGoalsData`, `getStatsData`) call different services

**Risk**: Inconsistent data between UI components

**Solution**: All handlers should use coordination service for focus-related data

### 6. **Testing Infrastructure**
**Files**: Multiple test files reference `buildAdaptiveSessionSettings()` directly
**Conflict**: Tests might break if we centralize logic in coordination service

**Risk**: Test failures, need for extensive test updates

**Solution**: Update tests to use coordination service, maintain backward compatibility

## 🟢 **LOW RISK CONFLICTS**

### 7. **Mock Services**
**Files**: `mockDashboardService.js`, `mockDataService.js`
**Conflict**: Mock data might not reflect coordination service structure

**Solution**: Update mocks to include coordination service responses

### 8. **Content Scripts & Chrome Messaging**
**Risk**: Extension messaging might expect current data structure

**Solution**: Maintain message format compatibility

## **ARCHITECTURAL INTEGRATION STRATEGY**

### Phase 1: Safe Integration (No Conflicts)
```javascript
// Create coordination service that CALLS existing systems
export class FocusCoordinationService {
  static async getFocusDecision(userId) {
    // 1. Check escape hatches FIRST
    const escapeHatches = await EscapeHatchUtils.detectApplicableEscapeHatches(...);
    
    // 2. Check tag graduation
    const graduation = await TagService.checkFocusAreasGraduation();
    
    // 3. Get base algorithm decision
    const systemRec = await TagService.getCurrentTier();
    
    // 4. Apply all considerations
    return this.buildUnifiedDecision(escapeHatches, graduation, systemRec, ...);
  }
}
```

### Phase 2: Coordination Integration
- Session generation calls coordination service
- Problem selection calls coordination service  
- UI calls coordination service
- **BUT**: Existing services still work independently

### Phase 3: Full Ownership (Future)
- Coordination service owns session state modifications
- Other systems notify coordination service of changes
- Single source of truth established

## **RECOMMENDED MODIFICATIONS TO PLAN**

### 1. **Respect Escape Hatch System**
```javascript
// Coordination service must honor escape hatch decisions
calculateAlgorithmDecision(systemRec, sessionState, escapeHatches) {
  let baseDecision = this.getBaseAlgorithmDecision(systemRec, sessionState);
  
  // Apply escape hatch modifications
  if (escapeHatches.activatedEscapeHatches.length > 0) {
    baseDecision = this.applyEscapeHatchModifications(baseDecision, escapeHatches);
  }
  
  return baseDecision;
}
```

### 2. **Handle Tag Graduation**
```javascript
// Check and handle graduated focus areas
async getFocusDecision(userId) {
  // Check if user focus areas need updating due to graduation
  const graduationStatus = await TagService.checkFocusAreasGraduation();
  if (graduationStatus.needsUpdate) {
    await TagService.graduateFocusAreas();
    // Refresh user preferences after graduation
  }
  
  // Continue with normal flow...
}
```

### 3. **Coordinate with Session State**
```javascript
// Don't override other systems' session state modifications
updateSessionState(sessionState, focusDecision) {
  // Only update focus-related fields
  return {
    ...sessionState,
    tagIndex: focusDecision.tagIndex,
    // DON'T touch: numSessionsCompleted, escapeHatches, etc.
  };
}
```

## **CONFLICT PREVENTION GUIDELINES**

### 1. **Coordination Service Boundaries**
- ✅ Controls: Tag selection, performance progression, onboarding rules
- ❌ Does NOT control: Escape hatches, graduation triggers, session completion

### 2. **Integration Pattern**
- Coordination service CALLS other systems, doesn't replace them
- Other systems can still function independently
- Gradual migration, not replacement

### 3. **State Ownership**
- Each system owns specific sessionState fields
- Coordination service only modifies focus-related fields
- Clear boundaries prevent conflicts

## **REVISED IMPLEMENTATION PLAN**

### Phase 1: Create Integration Layer (Safe)
```javascript
// Coordination service that integrates with existing systems
class FocusCoordinationService {
  static async getFocusDecision(userId) {
    // Integrate with existing systems, don't replace them
    const escapeHatches = await EscapeHatchUtils.detect(...);
    const graduation = await TagService.checkGraduation(...);
    const systemRec = await TagService.getCurrentTier();
    
    return this.buildCoordinatedDecision(...);
  }
}
```

### Phase 2: Update Callers (No Breaking Changes)
- Session generation calls coordination service
- Problem selection calls coordination service
- UI calls coordination service
- **All existing systems still work**

### Phase 3: Optimize (Future)
- Remove duplicate calls between systems
- Centralize session state modifications
- Full coordination implementation

This approach **minimizes conflicts** while **maintaining system integrity** and provides a **safe migration path**.

---

*Risk Level: MEDIUM - Manageable with careful integration*
*Recommendation: Proceed with integration approach, avoid replacement approach*