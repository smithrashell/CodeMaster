# 📚 CodeMaster Quick Reference Guide

> **Fast access to key concepts, terminology, and implementation details**

---

## 🔑 Core Concepts

### Learning System Architecture

**FSRS (Forgetting Spaced Repetition Scheduling)**
- Advanced spaced repetition algorithm optimizing long-term retention
- Uses stability calculations and decay scores for optimal review timing
- Implementation: `leitnerSystem.js` and `Learning Algorithm FSRS.md`

**Focus Window System**  
- Limits cognitive load by exposing 5 related tags at once
- tagIndex progression (0→4) within each window
- Graduates to new window when 4/5 tags mastered
- Implementation: `getIntelligentFocusTags()` in sessionService

**Pattern Ladders**
- Pre-built learning progressions for each algorithm tag
- Structured difficulty sequences ensuring optimal challenge
- Foundation for adaptive problem selection
- Data: `pattern_ladders` IndexedDB store

---

## 🏷️ Key Terminology

| Term | Definition | Implementation |
|------|------------|----------------|
| **Tag Mastery** | Success rate % for algorithm pattern | `tag_mastery` store, calculated in `tagServices.js` |
| **Box Level** | Leitner system level (1-8) indicating review frequency | `boxLevel` field in attempts, managed by `leitnerSystem.js` |
| **Tier** | Learning progression level (Core→Fundamental→Advanced) | `getCurrentTier()` function, tier-based tag organization |
| **Decay Score** | Forgetting calculation for spaced repetition | FSRS implementation, affects review scheduling |
| **Focus Tags** | Current 5 tags in learning window | `learningState.focusTags`, managed by session service |
| **tagIndex** | Position in current focus window (0-4) | Session state, controls progressive tag exposure |
| **Session Analytics** | Performance metrics per session | `session_analytics` store, comprehensive tracking |

---

## 📊 Data Architecture

### IndexedDB Stores (v24)

```
Database: CodeMaster (version 24)
├── problems              # Algorithm problems with metadata
├── attempts             # User solution attempts and performance  
├── sessions             # Learning session data and state
├── tag_mastery          # Progress tracking per algorithm pattern
├── pattern_ladders      # Structured learning progressions
├── problem_relationships # Problem similarity and connections
├── tag_relationships    # Tag correlation and prerequisite data
├── session_analytics    # Historical performance and insights
├── settings             # User preferences and configuration
└── session_state        # Current learning state and progress
```

### Key Data Flows

1. **Session Creation**: `sessionService.js` → `buildAdaptiveSessionSettings()` → `fetchAndAssembleSessionProblems()`
2. **Problem Selection**: Focus tags + mastery data + relationships → intelligent problem distribution
3. **Performance Tracking**: Attempts → FSRS calculations → mastery updates → session analytics
4. **Adaptive Learning**: Session performance → focus tag updates → tier progression

---

## 🎯 Algorithm Parameters

### Spaced Repetition Settings
```javascript
// FSRS Parameters
STABILITY_INCREASE_CORRECT = 1.2;    // Stability boost for correct answers
STABILITY_DECREASE_INCORRECT = 0.7;  // Stability reduction for mistakes
DEFAULT_STABILITY = 1.0;             // Starting stability for new problems
MAX_BOX_LEVEL = 8;                  // Maximum Leitner box level

// Session Composition  
REVIEW_PERCENTAGE = 0.4;            // 40% review problems
NEW_PERCENTAGE = 0.6;               // 60% new problems
PRIMARY_FOCUS_SPLIT = 0.6;          // 60% primary focus tag
EXPANSION_SPLIT = 0.4;              // 40% related tags
```

### Learning Progression Thresholds
```javascript
// Mastery Levels
MASTERY_THRESHOLD = 0.8;            // 80% success for mastery
LEARNING_ZONE_MIN = 0.4;            // 40% minimum for optimal challenge  
LEARNING_ZONE_MAX = 0.7;            // 70% maximum for optimal challenge

// Difficulty Progression
EASY_TO_MEDIUM_THRESHOLD = 0.9;     // 90% accuracy to unlock Medium
MEDIUM_TO_HARD_THRESHOLD = 0.9;     // 90% accuracy to unlock Hard
GRADUATION_THRESHOLD = 0.8;         // 80% threshold for focus tag graduation
```

---

## 🔧 Development Commands

### Build & Development
```bash
# Frontend Development
cd Frontend/
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run test         # Run test suite with coverage
npm run lint         # ESLint code quality check

# Extension Testing  
npm run test:watch   # Continuous testing during development
npm run test:ci      # CI-friendly test run with coverage
```

### Database Operations
```javascript
// Access IndexedDB stores (from Chrome DevTools)
// Open Application → Storage → IndexedDB → CodeMaster

// Common debugging queries
const tagMastery = await tagMasteryService.getAllTagMastery();
const currentSession = await sessionService.getCurrentSession();
const settings = await storageService.getSettings();
```

---

## 🚀 Chrome Extension Architecture

### File Structure
```
Frontend/
├── src/
│   ├── app/              # Standalone app pages
│   ├── content/          # Content script for LeetCode overlay
│   ├── popup/            # Extension popup interface  
│   └── shared/           # Common services, components, utilities
├── public/
│   ├── background.js     # Service worker for cross-tab communication
│   └── manifest.json     # Extension configuration and permissions
```

### Message Passing
```javascript
// Content Script → Background
chrome.runtime.sendMessage({
  action: 'addProblem',
  problem: problemData
});

// Background → IndexedDB
const result = await handleStorageOperation(request);
```

---

## 📈 Strategy Map Feature (In Development)

### Components Architecture
```
StrategyMap/
├── StrategyMap.jsx        # Main tier visualization  
├── TagPrimer.jsx         # Educational modal for tags
├── WhyThisProblem.jsx    # Problem context explanation
├── HintPanel.jsx         # Strategic guidance system
└── data/
    └── strategy_data.json # Static educational content
```

### User Experience Flow
1. **Visual Progress**: Tier-based layout showing tag mastery
2. **Educational Context**: Click tags for concept explanations  
3. **Problem Transparency**: Understand why problems are selected
4. **Strategic Hints**: Guidance during problem solving

---

## 🐛 Common Debugging Scenarios

### Session Issues
```javascript
// Check current session state
const session = await sessionService.getCurrentSession();
console.log('Session problems:', session?.problems.length);
console.log('Focus tags:', session?.settings.focusTags);

// Verify problem selection logic  
const settings = await sessionService.buildAdaptiveSessionSettings();
console.log('Adaptive settings:', settings);
```

### Mastery Calculation Issues
```javascript
// Debug tag mastery calculations
const mastery = await tagMasteryService.getTagMastery('Arrays');
console.log('Arrays mastery:', mastery);

// Check attempts for specific tag
const attempts = await attemptsService.getAttemptsByTag('Arrays');
console.log('Recent attempts:', attempts.slice(0, 5));
```

### Performance Issues
```javascript
// Monitor database operation times
console.time('tagMasteryCalculation');
const mastery = await tagMasteryService.calculateTagMastery();
console.timeEnd('tagMasteryCalculation');

// Check IndexedDB size
navigator.storage.estimate().then(estimate => {
  console.log('Storage used:', estimate.usage / 1024 / 1024, 'MB');
});
```

---

## 🔗 Quick Navigation Links

### Implementation Status
- **[Project Dashboard](README.md)** - Central navigation hub
- **[Current Status](Board/Code%20Master.md)** - What's complete vs. planned
- **[Implementation Roadmap](Board/Implementation%20Roadmap.md)** - Development timeline

### Technical Documentation  
- **[System Architecture](Board/OverView.md)** - Comprehensive design analysis
- **[Strategy Map Specs](Resources/StrategyMap/Technical%20Specs.md)** - Detailed feature requirements
- **[Database Schema](Resources/Data%20Storage/Data%20Storage.md)** - IndexedDB structure

### Learning Science
- **[FSRS Algorithm](Resources/Review%20Schedule/Learning%20Algorithm%20FSRS.md)** - Spaced repetition implementation
- **[Adaptive Sessions](Resources/Sessions/Adaptive%20Sessions.md)** - Intelligent session generation
- **[Tag Mastery](Resources/Tag%20Generation/Tag%20Generation.md)** - Progress tracking system

---

*This quick reference provides fast access to the most commonly needed information for CodeMaster development and debugging.*