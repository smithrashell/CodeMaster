# 🛠️ Strategy Map Technical Specifications

> **Status**: Not Implemented | **Priority**: Critical Launch Blocker | **Estimated Effort**: 2 weeks

---

## 📋 Overview

The Strategy Map is the critical user guidance layer that makes CodeMaster's sophisticated learning engine visible and understandable. It transforms the application from "another problem scheduler" to "intelligent learning companion" by providing visual progress tracking, educational context, and strategic guidance.

---

## 🏗️ Architecture Overview

### Core Components

```
StrategyMap/
├── StrategyMap.jsx           # Main visual tier layout component
├── TagPrimer.jsx            # Educational modal for tag explanations  
├── WhyThisProblem.jsx       # Problem selection transparency
├── HintPanel.jsx            # Strategic guidance during sessions
├── components/
│   ├── TierProgressRing.jsx # Individual tag progress visualization
│   ├── TagRelationshipMap.jsx # Visual tag connections
│   └── StrategyTooltip.jsx  # Contextual help tooltips
└── data/
    └── strategy_data.json   # Static content for tag strategies
```

---

## 🎯 Component Specifications

### 1. StrategyMap.jsx (Main Component)

**Purpose**: Visual tier-based progress map showing tag mastery and unlocked learning paths

**Technical Requirements**:
- **Framework**: React functional component with hooks
- **UI Library**: Mantine Grid, Card, Progress, Badge components
- **Data Sources**: 
  - `tag_mastery` store for progress data
  - `getCurrentTier()` function for tier organization
  - `learningState.focusTags` for current learning state
  - `pattern_ladders` for tag relationships

**Layout Design**:
```
┌─────────────────────────────────────────────────────────────────┐
│                        Strategy Map                             │
├─────────────────────────────────────────────────────────────────┤
│  Core Concepts (Tier 1)                                        │
│  ┌─Arrays─────┐ ┌─Hash Table─┐ ┌─Two Pointers┐                 │
│  │ ████ 85%  │ │ ██░░ 45%   │ │ ████ 92%    │                 │
│  │ Box 6/8   │ │ Box 3/8    │ │ Box 7/8     │                 │
│  └───────────┘ └────────────┘ └─────────────┘                 │
│                                                                 │
│  Fundamental Techniques (Tier 2) 🔒                            │
│  ┌─Prefix Sum─┐ ┌─Sliding Window┐ ┌─Binary Search┐             │
│  │ ░░░░ 15%  │ │ ░░░░ 8%      │ │ 🔒 Locked   │             │
│  │ Box 2/8   │ │ Box 1/8      │ │             │             │
│  └───────────┘ └──────────────┘ └─────────────┘             │
│                                                                 │
│  Advanced Techniques (Tier 3) 🔒                               │
│  ┌─Topological Sort┐ ┌─Union Find─┐ ┌─Dynamic Programming┐     │
│  │ 🔒 Locked      │ │ 🔒 Locked  │ │ 🔒 Locked          │     │
│  └────────────────┘ └────────────┘ └───────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

**Props Interface**:
```typescript
interface StrategyMapProps {
  userTier: number;
  tagMasteryData: TagMastery[];
  focusTags: string[];
  onTagClick: (tagName: string) => void;
}
```

**State Management**:
```typescript
const [selectedTag, setSelectedTag] = useState<string | null>(null);
const [primerOpen, setPrimerOpen] = useState(false);
const [hoveredTag, setHoveredTag] = useState<string | null>(null);
```

**Integration Points**:
- Route: `/strategy-map` added to React Router
- Navigation: Link added to main sidebar menu
- Data: Uses existing `useTagMastery()` and `useTags()` hooks
- Styling: Consistent with existing Mantine theme

---

### 2. TagPrimer.jsx (Educational Modal)

**Purpose**: Explains algorithm patterns, strategies, and relationships when users click tags

**Technical Requirements**:
- **Component Type**: Mantine Modal or Drawer
- **Trigger**: Click event from StrategyMap tag cards
- **Data Source**: `strategy_data.json` static content file
- **Content Sections**:
  1. Tag Overview (concept explanation)
  2. Common Patterns (typical problem structures)
  3. Strategy Tips (approach guidelines)
  4. Related Tags (learning connections)
  5. Example Problems (from `pattern_ladders`)

**Content Structure**:
```json
{
  "Arrays": {
    "overview": "Arrays are the foundational data structure for algorithm problems...",
    "commonPatterns": [
      "Two Pointer Technique",
      "Sliding Window",
      "Prefix/Suffix Sum",
      "In-place Manipulation"
    ],
    "strategyTips": [
      "Consider multiple pointers for optimization",
      "Think about sorting when order doesn't matter",
      "Use extra space for clarity before optimizing"
    ],
    "relatedTags": ["Two Pointers", "Sorting", "Hash Table"],
    "exampleProblems": ["Two Sum", "Maximum Subarray", "Merge Sorted Array"]
  }
}
```

**Props Interface**:
```typescript
interface TagPrimerProps {
  tagName: string;
  isOpen: boolean;
  onClose: () => void;
  tagData: StrategyData;
  relatedProblems: Problem[];
}
```

---

### 3. WhyThisProblem.jsx (Problem Context)

**Purpose**: Explains why specific problems were selected in adaptive sessions

**Technical Requirements**:
- **Component Type**: Collapsible info panel or tooltip
- **Placement**: Problem detail pages and session start
- **Data Sources**:
  - Session metadata (selection reasoning)
  - Tag weakness analysis
  - Recent attempt history
  - Mastery progression data

**Context Generation Logic**:
```typescript
function generateProblemContext(problem: Problem, sessionMeta: SessionMetadata): string {
  const reasons = [];
  
  if (sessionMeta.reviewProblem) {
    reasons.push(`This is a review problem to reinforce ${problem.tags[0]} mastery`);
  }
  
  if (sessionMeta.weakTag) {
    reasons.push(`Selected to strengthen your ${sessionMeta.weakTag} performance`);
  }
  
  if (sessionMeta.newPattern) {
    reasons.push(`Introduces new ${problem.tags[0]} pattern for learning progression`);
  }
  
  return reasons.join(". ");
}
```

**Integration Points**:
- **Problem Pages**: Small info icon with expandable explanation
- **Session Start**: Preview of problem selection reasoning
- **Dashboard**: Historical context for completed sessions

---

### 4. HintPanel.jsx (Strategic Guidance)

**Purpose**: Provides contextual hints during problem solving without spoiling solutions

**Technical Requirements**:
- **Component Type**: Optional sidebar or collapsible panel
- **Trigger**: User-activated "Show Hints" toggle
- **Data Sources**:
  - `problem_relationships` for similar problems
  - Recent failed attempts for pattern recognition
  - Tag strategy data for approach hints
  - User mastery level for hint complexity

**Hint Generation Algorithm**:
```typescript
function generateHints(problem: Problem, userAttempts: Attempt[]): Hint[] {
  const hints = [];
  
  // Strategy-based hints
  problem.tags.forEach(tag => {
    const strategy = strategyData[tag];
    if (strategy) {
      hints.push({
        type: 'strategy',
        content: strategy.commonApproach,
        relevance: calculateTagMastery(tag)
      });
    }
  });
  
  // Pattern-based hints from failed attempts
  const failedPatterns = analyzeFailedAttempts(userAttempts, problem.tags);
  failedPatterns.forEach(pattern => {
    hints.push({
      type: 'pattern',
      content: `Consider the ${pattern} approach you struggled with previously`,
      relevance: 0.8
    });
  });
  
  return hints.sort((a, b) => b.relevance - a.relevance);
}
```

**Hint Categories**:
1. **Strategic Hints**: High-level approach guidance
2. **Pattern Hints**: Specific technique suggestions  
3. **Relationship Hints**: Connections to solved problems
4. **Progress Hints**: Learning momentum and next steps

---

## 📊 Data Requirements

### strategy_data.json Structure

```json
{
  "version": "1.0",
  "lastUpdated": "2025-07-28",
  "tags": {
    "Arrays": {
      "tier": 1,
      "overview": "Fundamental data structure with contiguous memory layout...",
      "commonPatterns": [
        "Two Pointer Technique",
        "Sliding Window",
        "Prefix Sum",
        "In-place Operations"
      ],
      "strategyTips": [
        "Consider time/space tradeoffs",
        "Think about edge cases (empty, single element)",
        "Use sorting when order doesn't matter"
      ],
      "relatedTags": ["Two Pointers", "Sorting", "Hash Table"],
      "difficulty": {
        "easy": "Focus on basic iteration and indexing",
        "medium": "Apply two-pointer and sliding window techniques", 
        "hard": "Master in-place algorithms and complex optimizations"
      },
      "commonMistakes": [
        "Off-by-one errors in indexing",
        "Not handling empty array edge case",
        "Inefficient nested loop solutions"
      ]
    }
    // ... 20+ more tags
  }
}
```

### Integration with Existing Data

**tag_mastery Store**: 
- Current mastery percentage
- Box level progression  
- Recent performance trends
- Learning velocity metrics

**pattern_ladders Store**:
- Problem sequences per tag
- Difficulty progression
- Prerequisite relationships

**session_analytics Store**:
- Historical session performance
- Problem selection metadata
- Learning insights and recommendations

---

## 🎨 UI/UX Specifications

### Visual Design Principles

1. **Progressive Disclosure**: Show high-level progress first, details on demand
2. **Visual Hierarchy**: Clear tier separation with distinct styling
3. **Interactive Feedback**: Hover states, loading states, success animations
4. **Accessibility**: Keyboard navigation, screen reader support, color contrast
5. **Responsive Design**: Works on both extension popup and full-page views

### Color Coding System

```css
/* Mastery Levels */
.mastery-beginner { color: #ff6b6b; }     /* 0-30% - Red */
.mastery-learning { color: #ffd93d; }     /* 30-60% - Yellow */
.mastery-proficient { color: #6bcf7f; }  /* 60-80% - Light Green */
.mastery-expert { color: #51cf66; }      /* 80%+ - Dark Green */

/* Tier Styling */
.tier-core { border-left: 4px solid #339af0; }      /* Blue */
.tier-fundamental { border-left: 4px solid #7950f2; } /* Purple */
.tier-advanced { border-left: 4px solid #f76707; }    /* Orange */

/* Lock States */
.tag-locked { opacity: 0.5; filter: grayscale(100%); }
.tag-unlocked { opacity: 1; filter: none; }
```

### Animation Guidelines

- **Loading States**: Skeleton loaders for data fetching
- **Progress Updates**: Smooth progress bar animations
- **Transitions**: 200ms ease-in-out for state changes
- **Hover Effects**: Subtle scale (1.02x) and shadow effects
- **Success Feedback**: Green checkmark animations for completions

---

## 🔧 Implementation Phases

### Phase 1: Core Visualization (Week 1)
1. **StrategyMap.jsx** basic layout with tier organization
2. **Tag progress rings** with mastery percentages
3. **Lock/unlock logic** based on tier progression
4. **Basic routing** and navigation integration
5. **Static strategy_data.json** with 10 core tags

### Phase 2: Interactive Features (Week 2)
1. **TagPrimer.jsx** modal with educational content
2. **Click interactions** and state management
3. **WhyThisProblem.jsx** basic context explanations
4. **Session integration** for problem selection transparency
5. **Enhanced strategy data** with full tag coverage

### Phase 3: Advanced Features (Future)
1. **HintPanel.jsx** with strategic guidance
2. **Relationship visualization** between tags
3. **Personalized recommendations** based on performance
4. **Advanced analytics** and progress insights
5. **AI-generated content** expansion

---

## 🧪 Testing Requirements

### Unit Tests
- Component rendering with various props
- User interaction handling (clicks, hovers)
- Data integration with existing stores
- Strategy content loading and display
- Progress calculation accuracy

### Integration Tests
- Route navigation and sidebar integration
- Data flow from IndexedDB to components
- Session workflow with strategy map context
- Cross-component communication
- Performance with large datasets

### User Acceptance Tests
- New user onboarding with strategy map
- Tag progression and unlock experiences
- Problem context understanding
- Hint system effectiveness
- Overall user guidance improvement

---

## 📈 Success Metrics

### User Engagement
- **Strategy Map Page Views**: Target 80%+ of active users
- **Tag Primer Opens**: Average 3+ primers per session
- **Problem Context Usage**: 60%+ of users check "Why this problem?"
- **Session Completion Rate**: Increase from current baseline

### Learning Effectiveness  
- **User Comprehension**: Reduced support questions about problem selection
- **Learning Velocity**: Maintained or improved tag mastery progression
- **User Retention**: Increased session frequency due to better understanding
- **Feature Adoption**: Strategy Map becomes most-used feature after sessions

---

## ⚠️ Technical Considerations

### Performance
- **Bundle Size Impact**: Strategy data should be <50KB
- **Rendering Performance**: Virtualization for large tag lists
- **Data Loading**: Lazy loading of strategy content
- **Memory Usage**: Efficient component lifecycle management

### Accessibility
- **Keyboard Navigation**: Full tab order and focus management
- **Screen Readers**: Proper ARIA labels and descriptions
- **Color Blindness**: Alternative visual indicators beyond color
- **Motor Impairments**: Large click targets and hover tolerance

### Browser Compatibility
- **Chrome Extension**: Manifest v3 compliance
- **React Version**: Compatible with current 18.x
- **IndexedDB**: Error handling for storage limitations
- **Performance**: Smooth on lower-end devices

---

## 🔗 Dependencies

### Existing Codebase Integration
- **Data Layer**: `tag_mastery`, `pattern_ladders`, `session_analytics` stores
- **Services**: `tagServices`, `sessionService`, `problemService`
- **Hooks**: `useTagMastery()`, `useTags()`, `useSessionStorage()`
- **UI Components**: Existing Mantine theme and component library

### New Dependencies
- **strategy_data.json**: Static content file (new)
- **Route Configuration**: Add `/strategy-map` route (modification)
- **Navigation**: Add Strategy Map link to sidebar (modification)

### External Libraries
- **React Router**: For routing (existing)
- **Mantine**: For UI components (existing)  
- **Recharts**: For progress visualizations (existing)
- **No new external dependencies required**

---

*This technical specification provides the blueprint for implementing CodeMaster's Strategy Map feature - the critical component that transforms the application from functional to exceptional.*