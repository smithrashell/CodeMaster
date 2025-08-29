Based on Claude’s breakdown and your request, here’s a clean issue breakdown for your **Strategy Map implementation** using your preferred format:

---

## 🧠 Build core Strategy Map UI for tag tier visualization

### Summary

Implement the main `StrategyMap` component showing tags grouped by tier (Core, Fundamental, Advanced) with mastery progress and unlock status. This visual map will be the entry point for user understanding of progression.

### Tasks

-  Create `StrategyMap.jsx` with Mantine Grid layout
    
-  Display tags by tier using `getCurrentTier()` and `tag_mastery`
    
-  Add locked/unlocked logic using tier progression rules
    
-  Add mastery progress (e.g., rings or bar) per tag
    
-  Route: `/strategy` and add to sidebar navigation
    

### Why This Matters

This is the foundational UI for explaining user progress. Without it, users cannot see where they are in the learning journey or what’s next.

### Suggested Branch

`feat/strategy-map-ui`

### Labels

`feat`, `ui`, `priority: high`

---

## 📚 Implement TagPrimer panel for tag-level guidance

### Summary

Create a `TagPrimer` component shown when users click a tag on the Strategy Map. It should explain the tag’s concept, common patterns, and related tags to build conceptual scaffolding.

### Tasks

-  Create `TagPrimer.jsx` modal/drawer
    
-  Load data from static `strategy_data.json`
    
-  Display tag overview, examples, and related tags
    
-  Pull problem examples from `pattern_ladders[tag]`
    
-  Connect primer to tag click in `StrategyMap.jsx`
    

### Why This Matters

Tag primers help demystify new topics and reduce friction. This gives users the context they need when encountering new patterns.

### Suggested Branch

`feat/tag-primer-panel`

### Labels

`feat`, `learning-aid`, `priority: high`

---

## 💡 Add “Why This Problem?” context to session UI

### Summary

Explain to users why a problem was selected using session metadata like review priority, tag weakness, or novelty. This reduces user confusion during adaptive learning.

### Tasks

-  Create `WhyThisProblem.jsx` inline panel or tooltip
    
-  Generate context message based on tag weaknesses, decay, and mastery
    
-  Integrate with session UI — visible on each problem page
    
-  Use session construction metadata (e.g., `reason: "tag weakness"`)
    

### Why This Matters

Your adaptive engine is complex — users deserve visibility into its decisions. This feature builds trust and makes learning feel purposeful.

### Suggested Branch

`feat/problem-explanation-panel`

### Labels

`feat`, `session`, `explainability`, `priority: medium`

---

## 🧠 Create hint panel for session problem guidance

### Summary

Build a contextual `HintPanel` component to offer strategic hints during problem-solving, based on problem relationships and recent mistakes.

### Tasks

-  Create `HintPanel.jsx` as an optional session sidebar
    
-  Pull hints from `problem_relationships` and tag strategies
    
-  Match against recent failures in `attempts` store
    
-  Add toggle to show/hide hints during sessions
    

### Why This Matters

This increases session stickiness and supports frustrated users without spoiling solutions. It’s your first assistive layer.

### Suggested Branch

`feat/session-hint-panel`

### Labels

`feat`, `assistive`, `session`, `priority: medium`

---

## 📁 Create `strategy_data.json` with tag-level blurbs

### Summary

Build a static data file with strategy summaries for 15–20 core tags. Each entry includes a description, patterns, and related tags used in the `TagPrimer` and `HintPanel`.

### Tasks

-  Create `strategy_data.json`
    
-  Include tag overview, pattern summary, and common pairings
    
-  Start with top tags: Arrays, Hash Table, Sliding Window, etc.
    
-  Add optional `exampleProblems` array to link into ladders
    

### Why This Matters

This enables your strategy features without hardcoding content in components. You can also later regenerate/expand it with AI.

### Suggested Branch

`chore/strategy-data-seed`

### Labels

`chore`, `content`, `priority: medium`

---

Let me know if you’d like matching PR templates, commit messages, or scaffolding for any of these components.