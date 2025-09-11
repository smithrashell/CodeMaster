# 🎯 Interview Sessions

## Overview

Interview Sessions are specialized practice modes designed to prepare users for technical coding interviews. They simulate real interview conditions with time pressure, limited hints, and performance tracking to build interview-ready skills and confidence.

Unlike standard learning sessions that focus on spaced repetition and gradual skill building, interview sessions test **knowledge transfer** - your ability to apply learned patterns under pressure to new problems.

## 🎭 Interview Modes

CodeMaster offers three interview modes with increasing levels of challenge:

### 1. Standard Mode
**Purpose:** Regular adaptive learning sessions (not interview-specific)
- **Session Length:** Adaptive based on user performance
- **Hints:** Unlimited with no time restrictions
- **Timing:** No time pressure
- **UI Mode:** Full support with all features available
- **Problem Selection:** Spaced repetition + new problems

### 2. Interview-Like Mode
**Purpose:** Interview preparation with mild pressure
- **Session Length:** 3-5 problems
- **Hints:** Maximum 2 hints per problem, no time restrictions
- **Timing:** 
  - Time pressure indicators enabled
  - 1.5x normal time allowance (more generous)
  - Easy: 22 minutes, Medium: 37 minutes, Hard: 60 minutes
- **Problem Mix:** 60% mastered, 30% near-mastery, 10% challenging
- **UI Mode:** Pressure indicators visible
- **Focus:** Building confidence while introducing interview constraints

### 3. Full-Interview Mode
**Purpose:** Realistic interview simulation
- **Session Length:** 3-4 problems
- **Hints:** No hints available, time-restricted if attempted
- **Timing:**
  - Strict time pressure with hard cutoffs
  - Standard interview timing (1.0x multiplier)
  - Easy: 15 minutes, Medium: 25 minutes, Hard: 40 minutes
- **Problem Mix:** 60% mastered, 30% near-mastery, 10% wildcard
- **UI Mode:** Minimal, clean interface
- **Focus:** Realistic interview conditions

## 🏆 Interview Readiness Assessment

The system automatically assesses your readiness for different interview modes:

### Requirements for Interview-Like Mode
- **Accuracy:** 70%+ success rate in recent sessions
- **Mastery:** At least 3 mastered tags
- **Consistency:** Stable performance over time

### Requirements for Full-Interview Mode
- **All Interview-Like requirements PLUS:**
- **Transfer Performance:** 70%+ transfer readiness score
- **Advanced Accuracy:** 80%+ success rate in recent sessions

### Readiness Calculation
```javascript
// Simplified readiness logic
const readiness = {
  interviewLikeUnlocked: accuracy >= 0.7 && masteredTags >= 3,
  fullInterviewUnlocked: accuracy >= 0.8 && transferScore >= 0.7,
  reasoning: "Why this mode is/isn't available"
};
```

### Development Mode
For testing, all interview modes are available with fallback reasoning provided.

## 🧠 Problem Selection Strategy

### Key Differences from Standard Sessions
1. **No Spaced Repetition:** Interview sessions don't include review problems
2. **Mastery-Based Selection:** Problems chosen based on your tag mastery levels
3. **Performance Mix:** Strategic distribution of problem difficulties
4. **Transfer Focus:** Tests ability to apply patterns to new problems

### Problem Mix Strategy
Interview sessions use sophisticated problem distribution:

```javascript
// Interview-Like & Full-Interview Mode Distribution
mastered: 60%     // Problems from mastered tags (confidence builders)
nearMastery: 30%  // Problems from near-mastered tags (skill validation) 
challenging: 10%  // Stretch problems (interview-like scenarios)
```

### Tag-Based Selection
- **Mastered Tags:** Tags you've demonstrated consistent success with
- **Near-Mastery Tags:** Tags with 3+ attempts and some success
- **Selection Logic:** Filters available problems by your mastery data

## 📊 Performance Tracking

### Transfer Metrics
Interview sessions track specialized metrics:

1. **Transfer Accuracy (TA):** First-attempt correctness (35% weight)
2. **Speed Delta:** Performance vs. baseline (25% weight)  
3. **Hint Pressure:** Hints used per minute (20% weight)
4. **Approach Latency:** Time to first structured plan (20% weight)

### Transfer Readiness Score (TRS)
Composite score (0-1) indicating interview readiness:
- **0.7+:** Ready for Full-Interview mode
- **0.5-0.7:** Continue Interview-Like practice
- **<0.5:** Focus on fundamentals

### Intervention Need Score (INS)
Calculated as `1 - TRS`, indicates areas needing improvement.

## 🔄 Integration with Adaptive Learning

Interview performance directly influences your standard learning sessions:

### Recommendations Based on Interview Results
- **Poor Transfer (< 60%):** Longer standard sessions with more review
- **Speed Issues (>30% slower):** Speed-focused practice sessions
- **Hint Dependency (>1.5/min):** Reduced hint availability training
- **Good Performance (>80%):** More challenging standard sessions

### Cross-Pollination
- Interview weak tags → Focus areas for standard sessions
- Interview insights → Session length adjustments
- Transfer difficulties → Adaptive difficulty modifications

## 🎮 User Experience

### Starting an Interview Session
1. Navigate to session generator
2. Select interview mode (if unlocked)
3. System checks readiness and creates appropriate session
4. Begin interview with mode-specific constraints

### During Interview Sessions
- **Pressure Indicators:** Visual time pressure feedback (Interview-Like mode)
- **Minimal UI:** Clean interface for focus (Full-Interview mode)
- **Constraint Enforcement:** Hints/timing automatically managed
- **Real-time Metrics:** Performance tracking in background

### After Interview Completion
- **Comprehensive Analysis:** Transfer metrics and feedback
- **Improvement Suggestions:** Specific areas to work on
- **Next Steps:** Recommendations for continued practice

## ⚡ Fallback & Error Handling

### Circuit Breaker Pattern
Interview sessions include robust fallback mechanisms:
- **Failed Interview Creation:** Automatically falls back to standard session
- **Problem Selection Errors:** Uses standard problem assembly
- **Timeout Protection:** Prevents hanging on interview-specific operations

### Graceful Degradation
- Interview features failing → Standard session with interview metadata
- Database issues → Cached fallback configurations
- Service timeouts → Simplified interview mode

## 🔧 Technical Implementation

### Key Components
- **`InterviewService.js`:** Core interview logic and configurations
- **`ProblemService.createInterviewSession()`:** Interview session creation
- **`SessionService`:** Unified session management with interview support
- **Session Attribution Engine:** Routes problems to appropriate sessions

### Database Integration
- **Sessions Store:** Interview sessions with `sessionType` and `interviewConfig`
- **Attempts Store:** Enhanced with interview performance signals  
- **Analytics Store:** Interview-specific metrics and feedback

### Chrome Extension Integration
```javascript
// Background script interview session creation
case "createInterviewSession":
  const session = await ProblemService.createInterviewSession(request.mode);
  sendResponse({ success: true, session });
  break;
```

## 🎯 Best Practices

### For Users
1. **Build Fundamentals First:** Achieve 70%+ accuracy before interview practice
2. **Progress Gradually:** Start with Interview-Like before Full-Interview
3. **Practice Regularly:** Interview skills need consistent reinforcement
4. **Analyze Results:** Review transfer metrics to identify improvement areas

### For Developers
1. **Handle Fallbacks:** Always provide graceful degradation paths
2. **Monitor Performance:** Track interview session success rates
3. **Maintain Configurations:** Keep timing/constraint configs updated
4. **Test Extensively:** Interview mode edge cases need thorough testing

## 🐛 Troubleshooting

### Common Issues

#### Interview Modes Not Available
- **Check Accuracy:** Must be 70%+ for Interview-Like, 80%+ for Full-Interview
- **Verify Mastery:** Need at least 3 mastered tags
- **Recent Performance:** System uses recent session data

#### Interview Sessions Falling Back to Standard
- **Database Issues:** Check IndexedDB connectivity
- **Service Timeouts:** Interview creation has timeout protection
- **Configuration Errors:** Verify interview configs are valid

#### Performance Tracking Not Working
- **Attempt Attribution:** Ensure attempts are linked to interview sessions
- **Metrics Calculation:** Check interview signals in attempt data
- **Analytics Storage:** Verify interview analytics are being stored

### Debug Tools
```javascript
// Check interview readiness
const readiness = await InterviewService.assessInterviewReadiness();
console.log('Interview readiness:', readiness);

// View interview configurations  
const configs = InterviewService.INTERVIEW_CONFIGS;
console.table(configs);

// Check recent interview performance
const insights = await InterviewService.getInterviewInsightsForAdaptiveLearning();
console.log('Interview insights:', insights);
```

---

Interview Sessions provide a comprehensive system for building real interview skills through progressive challenge levels, performance tracking, and intelligent integration with your overall learning journey.