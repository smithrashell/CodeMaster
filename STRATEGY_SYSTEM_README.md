# 🧠 Strategy System Integration Guide

## Overview

The Strategy System provides **context-aware hints** and **educational primers** to help users understand algorithmic concepts and solve problems more effectively. It consists of two main components:

1. **🎯 Hint Panel** - Real-time, context-aware strategies during problem solving
2. **📖 Primer Section** - Educational overviews before starting a problem

---

## 🗄️ Part 1: IndexedDB Integration

### Database Schema Changes

**New Store Added:** `strategy_data`
- **Key Path:** `tag` (string)
- **Index:** `by_tag` on `tag` field
- **Version:** Incremented to 25

### Data Structure

Each strategy entry contains:
```json
{
  "tag": "array",
  "overview": "The foundational data structure...",
  "patterns": ["greedy", "dynamic programming", "math"],
  "related": ["hash table", "two pointers", "sorting"],
  "strategy": "Use index-based traversal and consider...",
  "strategies": [
    {
      "when": "hash table",
      "tip": "Track seen elements or indices using a hash map..."
    }
  ]
}
```

### Automatic Initialization

The system automatically:
✅ Checks if strategy data exists in IndexedDB  
✅ Uploads from `strategy_data_enriched.json` if missing  
✅ Prevents duplicate uploads  
✅ Handles errors gracefully  

---

## 🎯 Part 2: Hint Panel Component

### Purpose
Shows **real-time, context-aware strategies** during problem solving based on the current problem's tags.

### Usage
```jsx
import { HintPanel } from '../shared/components/strategy';

<HintPanel 
  problemTags={['array', 'hash table']} 
  isVisible={true}
  className="custom-class"
/>
```

### Features
- **Multi-tag strategies**: Shows specific advice when multiple tags are present
- **General strategies**: Shows single-tag guidance
- **Collapsible UI**: Expandable/collapsible with hint count
- **Loading states**: Smooth loading and error handling
- **Relevance sorting**: Contextual hints shown first

### Example Output
```
💡 Strategy Hints (3)

Multi-Tag Strategies:
[array] + [hash table]
"Track seen elements or indices using a hash map to reduce nested loops from O(n²) to O(n)."

General Strategies:
[array]
"Use index-based traversal and consider multiple pointers for optimization."
```

---

## 📖 Part 3: Primer Section Component

### Purpose
Displays **educational overviews and general strategies** before users start solving a problem.

### Usage
```jsx
import { PrimerSection } from '../shared/components/strategy';

<PrimerSection 
  problemTags={['binary tree', 'recursion']} 
  isVisible={true}
  className="custom-class"
/>
```

### Features
- **Tag overviews**: What each tag/concept is about
- **General approaches**: High-level problem-solving strategies
- **Common patterns**: Frequently used techniques
- **Related tags**: What tags often appear together
- **Clean layout**: Professional card-based design

### Example Output
```
📚 Problem Overview
Key concepts and strategies for this problem

[binary tree]
What it is: Tree data structure where each node has at most two children...
General approach: Master three traversal orders: inorder, preorder, postorder...
Common patterns: [binary search tree] [tree] [dynamic programming]
Often combined with: [recursion] [depth-first search]
```

---

## 🎣 Part 4: React Hook (useStrategy)

### Purpose
Provides programmatic access to strategy data with React state management.

### Usage
```jsx
import { useStrategy } from '../shared/hooks/useStrategy';

const MyComponent = ({ problemTags }) => {
  const {
    hints,
    primers,
    loading,
    error,
    hasHints,
    contextualHints,
    generalHints,
    refreshStrategy
  } = useStrategy(problemTags);

  // Your component logic here
};
```

### Returned Values
```javascript
{
  // Data
  hints: [],           // All hints for current tags
  primers: [],         // All primers for current tags
  
  // State
  loading: false,      // Loading state
  error: null,         // Error message if any
  isDataLoaded: true,  // Whether IndexedDB has strategy data
  
  // Computed
  hasHints: true,      // Whether hints are available
  hasPrimers: true,    // Whether primers are available
  contextualHints: [], // Multi-tag strategies only
  generalHints: [],    // Single-tag strategies only
  
  // Functions
  refreshStrategy,     // Manually refresh data
  getTagStrategy,      // Get strategy for specific tag
  getTagPrimer,        // Get primer for specific tag
  clearError          // Clear current error
}
```

---

## 🚀 Part 5: Integration Examples

### Basic Integration
```jsx
// In your problem component
import { HintPanel, PrimerSection } from '../shared/components/strategy';

const ProblemPage = ({ problem }) => {
  return (
    <div>
      {/* Show primer before problem starts */}
      <PrimerSection problemTags={problem.tags} />
      
      {/* Problem content here */}
      <div>{problem.description}</div>
      
      {/* Show hints during problem solving */}
      <HintPanel problemTags={problem.tags} />
    </div>
  );
};
```

### Advanced Integration with Hook
```jsx
import { useStrategy } from '../shared/hooks/useStrategy';
import { HintPanel, PrimerSection } from '../shared/components/strategy';

const AdvancedProblemPage = ({ problem }) => {
  const {
    loading,
    error,
    hasHints,
    contextualHints,
    refreshStrategy
  } = useStrategy(problem.tags);

  if (loading) return <div>Loading strategy data...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <PrimerSection problemTags={problem.tags} />
      
      {hasHints && (
        <HintPanel problemTags={problem.tags} />
      )}
      
      {contextualHints.length > 0 && (
        <div>Found {contextualHints.length} multi-tag strategies!</div>
      )}
      
      <button onClick={refreshStrategy}>
        Refresh Strategies
      </button>
    </div>
  );
};
```

### Conditional Display
```jsx
const SmartHintPanel = ({ problem, userProgress }) => {
  const showHints = userProgress.attempts > 2; // Show hints after 2 attempts
  const showPrimer = userProgress.attempts === 0; // Show primer only initially
  
  return (
    <>
      {showPrimer && <PrimerSection problemTags={problem.tags} />}
      {showHints && <HintPanel problemTags={problem.tags} />}
    </>
  );
};
```

---

## ⚡ Part 6: Performance Considerations

### IndexedDB Optimizations
- ✅ **Single upload check**: Prevents duplicate data loading
- ✅ **Indexed queries**: Fast lookups by tag name
- ✅ **Batched operations**: Efficient bulk uploads
- ✅ **Error handling**: Graceful fallbacks

### React Optimizations
- ✅ **Effect dependencies**: Only reload when tags change
- ✅ **Loading states**: Prevent UI flicker
- ✅ **Memoized calculations**: Efficient filtering
- ✅ **Conditional rendering**: Skip unnecessary renders

### Memory Management
- ✅ **Lazy loading**: Data loaded only when needed
- ✅ **Component cleanup**: Proper useEffect cleanup
- ✅ **Cached instances**: Reuse IndexedDB connections

---

## 🔧 Part 7: Customization Options

### Styling
```jsx
// Custom CSS classes
<HintPanel className="my-hint-panel" />
<PrimerSection className="my-primer-section" />
```

### Behavior
```jsx
// Control visibility
<HintPanel isVisible={showHints} />

// Handle loading states
const { loading, error } = useStrategy(tags);
```

### Content Filtering
```jsx
// Show only contextual hints
const { contextualHints } = useStrategy(tags);
contextualHints.map(hint => /* render hint */);

// Show only general strategies
const { generalHints } = useStrategy(tags);
generalHints.map(hint => /* render hint */);
```

---

## 🐛 Part 8: Troubleshooting

### Common Issues

**1. Strategy data not loading**
```js
// Check if data is initialized
const { isDataLoaded } = useStrategy([]);
console.log('Data loaded:', isDataLoaded);
```

**2. Components not showing**
```js
// Verify tags are passed correctly
<HintPanel problemTags={['array', 'hash table']} />  // ✅ Good
<HintPanel problemTags={[]} />                       // ❌ Empty array
<HintPanel />                                        // ❌ No tags
```

**3. IndexedDB errors**
```js
// Check browser console for IndexedDB errors
// Ensure version number was incremented in index.js
```

### Debug Information
```jsx
const {
  hints,
  primers,
  loading,
  error,
  isDataLoaded
} = useStrategy(problemTags);

console.log({
  hintsCount: hints.length,
  primersCount: primers.length,
  isLoading: loading,
  hasError: !!error,
  dataLoaded: isDataLoaded,
  tags: problemTags
});
```

---

## 📁 Part 9: File Structure

```
Frontend/src/
├── shared/
│   ├── components/strategy/
│   │   ├── HintPanel.jsx       # Real-time hints component
│   │   ├── PrimerSection.jsx   # Pre-problem primer component
│   │   └── index.js            # Component exports
│   ├── services/
│   │   └── strategyService.js  # IndexedDB service layer
│   ├── hooks/
│   │   └── useStrategy.js      # React hook for strategy data
│   └── db/
│       └── index.js            # Updated with strategy_data store
├── examples/
│   └── StrategyIntegrationExample.jsx  # Complete usage example
└── strategy_data_enriched.json         # Source data file
```

---

## ✅ Part 10: Quick Start Checklist

1. **✅ Database Updated**: IndexedDB version incremented to 25
2. **✅ Store Created**: `strategy_data` store added to schema
3. **✅ Service Ready**: StrategyService handles all data operations
4. **✅ Components Built**: HintPanel and PrimerSection ready to use
5. **✅ Hook Available**: useStrategy provides advanced functionality
6. **✅ Auto-Initialization**: Data loads automatically on app start

### Next Steps
1. Import components in your problem pages
2. Pass problem tags to components
3. Customize styling as needed
4. Test with different tag combinations
5. Monitor performance and user engagement

---

*The Strategy System transforms your coding practice app from problem delivery to intelligent tutoring, providing contextual guidance that adapts to each problem's unique requirements.*