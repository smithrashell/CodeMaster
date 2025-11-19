## Problem Statement

CodeMaster currently doesn't handle large gaps in usage well (6+ months). When users return after extended breaks, they experience a demoralizing "fail-fest" as they must fail through problems one-by-one to reset their mastery levels.

### Current Behavior

**What Works ✅**
- Review scheduling persists indefinitely
- Overdue problems are detected when user returns
- Metadata (box levels, stability, history) is preserved
- Session staleness detection for focus area changes

**Critical Gaps ❌**

1. **No Time-Based Decay**
   - Current FSRS implementation (`problems.js:1067`) doesn't consider time elapsed
   - Stability only changes on attempts, not from passage of time
   - Real FSRS uses forgetting curves based on time gaps

   ```javascript
   // Current implementation - NO time consideration
   export function updateStabilityFSRS(currentStability, wasCorrect) {
     if (wasCorrect) {
       return parseFloat((currentStability * 1.2 + 0.5).toFixed(2));
     } else {
       return parseFloat((currentStability * 0.7).toFixed(2));
     }
   }
   ```

2. **All Overdue Problems Treated Equally**
   - 1 day overdue = 1 year overdue = 10 years overdue
   - No prioritization by "how overdue"
   - No concept of "forgotten everything after 2 years"

3. **No Returning User Detection**
   - No last activity date tracking
   - No recalibration suggestions
   - No assessment when returning after gaps

4. **Box Levels Don't Decay**
   - Problems in Box 4 (mastered) stay there forever
   - After 2 years of inactivity, still marked "mastered"
   - Only demotion happens through failure

### User Experience Gap Scenarios

**Gap < 1 month:** ✅ Works great
**Gap 1-3 months:** ⚠️ Works but clunky
**Gap 6+ months:** ❌ Poor experience - user must fail through all problems to prove they've forgotten

## Proposed Solution: 3-Layer Hybrid Recalibration

### Layer 1: Passive Background Decay (Silent)

Run on app startup when gap detected. Applies conservative time-based decay without user interaction.

```javascript
async function applyPassiveDecay(daysSinceLastUse) {
  if (daysSinceLastUse < 30) return; // No decay needed

  const allProblems = await fetchAllProblems();

  for (const problem of allProblems) {
    const daysSinceLastAttempt = getDaysSince(problem.last_attempt_date);

    // Conservative decay: reduce box level based on time
    const decayAmount = Math.floor(daysSinceLastAttempt / 60); // 1 box per 2 months
    problem.box_level = Math.max(1, problem.box_level - decayAmount);

    // Decay stability using forgetting curve
    const forgettingFactor = Math.exp(-daysSinceLastAttempt / 90); // 90-day half-life
    problem.stability = Math.max(0.5, problem.stability * forgettingFactor);

    // Mark as needs recalibration
    problem.needs_recalibration = daysSinceLastAttempt > 90;
  }

  await saveProblems(allProblems);
}
```

### Layer 2: Smart Welcome Back Flow (User-Facing)

Show contextual message based on gap duration. Give users options for recalibration approach.

```javascript
function getWelcomeBackStrategy(daysSinceLastUse) {
  if (daysSinceLastUse < 30) {
    return { type: 'normal' }; // Business as usual
  }

  if (daysSinceLastUse < 90) {
    return {
      type: 'gentle_recal',
      message: "You've been away for a while. First session will help us recalibrate.",
      approach: 'adaptive_first_session'
    };
  }

  if (daysSinceLastUse < 365) {
    return {
      type: 'moderate_recal',
      message: "Welcome back! Let's find your current level.",
      options: [
        {
          label: "Quick Assessment (5 problems)",
          time: "~15 min",
          approach: 'diagnostic'
        },
        {
          label: "Adaptive Session (learn while we calibrate)",
          time: "~30 min",
          approach: 'adaptive_first_session'
        }
      ]
    };
  }

  // Gap > 1 year
  return {
    type: 'major_recal',
    message: "It's been a while! Let's see what you remember.",
    recommendation: 'diagnostic',
    options: [
      {
        label: "5-Minute Diagnostic (recommended)",
        description: "Sample problems from your previous topics",
        approach: 'diagnostic'
      },
      {
        label: "Start Fresh",
        description: "Reset and rebuild (keeps history)",
        approach: 'reset'
      },
      {
        label: "Jump Back In",
        description: "Start sessions, adapt as we go",
        approach: 'adaptive_first_session'
      }
    ]
  };
}
```

### Layer 3A: Quick Diagnostic Session (Optional)

Sample 5-7 problems strategically from mastered topics to quickly calibrate entire database.

```javascript
async function createDiagnosticSession(userHistory) {
  // Sample 5-7 problems strategically:
  // - 1 from each mastered topic (Box 3+)
  // - Mixed difficulties
  // - Problems they succeeded on before

  const masteredTopics = await getMasteredTopics(); // ["arrays", "two-pointer", "dp"]
  const diagnosticProblems = [];

  for (const topic of masteredTopics.slice(0, 5)) {
    // Get their BEST problem from this topic (one they solved well before)
    const bestProblem = await getBestProblemForTopic(topic, {
      previousSuccess: true,
      difficulty: 'Medium',
      boxLevel: [3, 4] // Previously mastered
    });

    diagnosticProblems.push({
      ...bestProblem,
      _diagnostic: true,
      _topic: topic,
      _expectedPerformance: 'should_remember'
    });
  }

  return {
    type: 'diagnostic',
    problems: diagnosticProblems,
    instructions: "Quick check: Solve these problems you've done before. This helps us calibrate your current level."
  };
}

async function processDiagnosticResults(results) {
  const topicRetention = {};

  for (const result of results) {
    topicRetention[result.topic] = result.success;
    const topicProblems = await getProblemsByTopic(result.topic);

    if (result.success && result.timeSpent < expectedTime * 1.5) {
      // User remembers this topic well - minimal decay
      topicProblems.forEach(p => {
        p.box_level = Math.max(2, p.box_level);
        p.needs_recalibration = false;
      });
    } else if (result.success && result.timeSpent > expectedTime * 2) {
      // User remembers but rusty - moderate decay
      topicProblems.forEach(p => {
        p.box_level = Math.max(1, p.box_level - 1);
        p.stability *= 0.7;
      });
    } else {
      // User forgot - significant decay
      topicProblems.forEach(p => {
        p.box_level = 1;
        p.stability = 0.5;
      });
    }
  }

  const retained = Object.values(topicRetention).filter(v => v).length;
  return {
    recalibrated: true,
    retained,
    total: results.length,
    message: `You retained ${retained}/${results.length} topics. Sessions adjusted accordingly.`
  };
}
```

### Layer 3B: Adaptive First Session (Default)

Build graduated difficulty session that recalibrates in real-time as user solves problems.

```javascript
async function createAdaptiveRecalibrationSession() {
  const userTopics = await getMasteredTopics();
  const problems = [];

  // Problems 1-2: Easy wins (confidence builders)
  problems.push(...await getProblems({
    topics: userTopics,
    difficulty: 'Easy',
    previousSuccess: true,
    limit: 2
  }));

  // Problems 3-4: Medium from mastered topics (true test)
  problems.push(...await getProblems({
    topics: userTopics,
    difficulty: 'Medium',
    boxLevel: [3, 4],
    limit: 2
  }));

  // Problems 5-6: Harder (stretch)
  problems.push(...await getProblems({
    topics: userTopics,
    difficulty: 'Medium',
    boxLevel: [2, 3],
    limit: 2
  }));

  return {
    type: 'adaptive_recalibration',
    problems,
    onAttempt: async (problemId, result) => {
      await adjustCalibrationMidSession(problemId, result);
    }
  };
}

async function adjustCalibrationMidSession(problemId, result) {
  const sessionResults = await getCurrentSessionResults();
  const successRate = sessionResults.filter(r => r.success).length / sessionResults.length;

  if (successRate > 0.8 && sessionResults.length >= 3) {
    // User doing great - they remember more than we thought
    await cancelScheduledDecay(userTopics);
  } else if (successRate < 0.4 && sessionResults.length >= 3) {
    // User struggling - apply additional decay
    await applyAdditionalDecay(userTopics, 0.5);
  }
}
```

## Why This Approach is Better

### 1. User Choice = Better UX
- **Gap < 1 month:** Silent recalibration (seamless)
- **Gap 1-3 months:** "First session will recalibrate" (gentle, automatic)
- **Gap 3-12 months:** Give options (diagnostic OR adaptive)
- **Gap > 1 year:** Recommend diagnostic, allow other paths

### 2. Avoids Both Extremes
- ❌ Don't reset everything to box 1 (too harsh, demoralizing)
- ❌ Don't assume perfect memory (leads to fail-fest)
- ✅ Conservative decay + smart validation = optimal middle ground

### 3. Respects Cognitive Science
Forgetting curve: `Memory = e^(-t/S)` where t = time, S = stability

After 90 days:
- High stability (3.0): ~74% retention
- Medium stability (1.5): ~55% retention
- Low stability (0.8): ~36% retention

Current code assumes 100% retention forever (incorrect).

### 4. Fast Feedback Loop
- Diagnostic: 5 problems → calibrate hundreds
- User sees results immediately
- Feels accomplishment, not failure
- **Key insight:** Testing topics, not individual problems

## Implementation Plan

### Phase 1: Passive Decay (Estimated: 2-3 hours)
**Priority:** High
**Effort:** Low

- [ ] Add `last_activity_date` tracking to storage service
- [ ] Implement `applyPassiveDecay()` function
- [ ] Run on app startup (non-blocking)
- [ ] Add forgetting curve calculations
- [ ] Update FSRS to consider time gaps

**Files to modify:**
- `src/shared/db/problems.js` - Update `updateStabilityFSRS()`
- `src/shared/services/storageService.js` - Track last activity
- `public/background.js` - Run decay check on startup

### Phase 2: Welcome Back Modal (Estimated: 3-4 hours)
**Priority:** High
**Effort:** Medium

- [ ] Create `WelcomeBackModal` component
- [ ] Implement `getWelcomeBackStrategy()` logic
- [ ] Add gap detection on app initialization
- [ ] Design modal UI with options
- [ ] Store user preference for recalibration approach

**Files to create:**
- `src/app/components/modals/WelcomeBackModal.jsx`
- `src/shared/services/recalibrationService.js`

### Phase 3: Diagnostic Session (Estimated: 6-8 hours)
**Priority:** Medium
**Effort:** High

- [ ] Implement `createDiagnosticSession()`
- [ ] Build `processDiagnosticResults()` logic
- [ ] Create diagnostic UI/flow
- [ ] Add retention summary display
- [ ] Apply topic-based recalibration

**Files to create:**
- `src/shared/services/diagnosticService.js`
- `src/app/components/diagnostic/DiagnosticSession.jsx`
- `src/app/components/diagnostic/RetentionSummary.jsx`

### Phase 4: Adaptive First Session (Estimated: 6-8 hours)
**Priority:** Low
**Effort:** High

- [ ] Implement `createAdaptiveRecalibrationSession()`
- [ ] Add mid-session calibration logic
- [ ] Real-time difficulty adjustment
- [ ] Cancel/apply decay based on performance

**Files to modify:**
- `src/shared/services/sessionService.js`
- `src/shared/services/problemService.js`

### Phase 5: Analytics & Monitoring (Estimated: 2-3 hours)
**Priority:** Low
**Effort:** Low

- [ ] Track recalibration events
- [ ] Monitor retention accuracy
- [ ] Add diagnostic success metrics
- [ ] Dashboard widget for "days since last use"

## Success Metrics

- **User retention:** % of returning users (gap > 90 days) who complete first session
- **Diagnostic accuracy:** Correlation between diagnostic results and subsequent performance
- **Time to recalibrate:** Average time to get back to optimal learning zone
- **User satisfaction:** Feedback on recalibration experience vs. old "fail-fest"

## Technical Considerations

### Database Schema Changes
Add to `problems` store:
```javascript
{
  needs_recalibration: boolean,
  decay_applied_date: ISO timestamp,
  original_box_level: number // Before decay, for rollback
}
```

Add to storage:
```javascript
{
  last_activity_date: ISO timestamp,
  recalibration_history: [{
    date: ISO timestamp,
    gap_days: number,
    approach: 'diagnostic' | 'adaptive' | 'skip',
    results: { retained: number, total: number }
  }]
}
```

### Performance Considerations
- Passive decay should be async/non-blocking
- Cache last activity date (don't query every session)
- Diagnostic results should batch-update problems
- Consider web worker for heavy calculations

## Related Issues

This addresses the core insight from our market positioning: CodeMaster is valuable for **irregular users** who study in bursts. The current implementation doesn't fully support this use case.

## Questions for Discussion

1. Should passive decay be opt-in or automatic?
2. What's the ideal diagnostic session length? (Currently proposed: 5 problems)
3. Should we show decay calculations to users or keep it hidden?
4. Do we need a "reset all" escape hatch for users who want to start completely fresh?
