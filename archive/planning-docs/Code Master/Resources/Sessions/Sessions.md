# Smart Study Sessions

## What This Does
**CodeMaster creates personalized study sessions by intelligently selecting which LeetCode problems you should work on next.** Instead of randomly picking problems, it uses the Leitner spaced repetition system combined with tag relationships to create optimized learning sessions that adapt to your progress.

## How Sessions Work

### 🎯 **The Core Strategy**
Every session contains a mix of:
- **40% Review Problems**: Problems you've seen before that are due for review (from your Leitner boxes)
- **60% New Problems**: Fresh problems to expand your knowledge
  - 60% focus on your current learning tags (what you're actively studying)  
  - 40% introduce related concepts (to build connections)

### 🧠 **The Focus Window System**
Instead of overwhelming you with all possible coding topics, CodeMaster:
1. **Limits you to 5 related tags at a time** (prevents cognitive overload)
2. **Progresses you through each tag systematically** (tagIndex 0→1→2→3→4)
3. **Graduates you to new concepts** when you master 4 out of 5 current tags
4. **Chooses related topics** based on actual problem relationships, not random selection

### 📈 **Adaptive Difficulty**
The system starts conservative and unlocks harder problems based on your performance:
- **New tags start with Easy problems only**
- **Medium problems unlock** when you hit 60% success rate on Easy
- **Hard problems unlock** when you hit 65% success rate on Medium

## What Happens During a Session

### 1. **Session Generation**
When you start a study session, CodeMaster:
- Analyzes which problems are due for review (Leitner scheduling)
- Looks at your current focus window (5 tags you're learning)
- Selects new problems that match your skill level
- Creates a balanced mix optimized for learning

### 2. **Problem Selection Logic**
The system considers:
- **Your mastery level** for each tag/concept
- **Time since last review** (spaced repetition timing)
- **Problem relationships** (which concepts build on each other)
- **Your success rates** (to determine appropriate difficulty)

### 3. **Session Completion**
After you finish a session:
- **Performance gets analyzed** (accuracy, timing, efficiency)
- **Leitner boxes get updated** (problems move up/down based on success)
- **Mastery scores are recalculated** (tag progress tracking)
- **Future sessions are adjusted** based on your results

## The Intelligence Behind It

### 🔄 **Spaced Repetition Integration**
- Problems you struggle with come back sooner
- Problems you master appear less frequently  
- Review timing follows proven memory research
- Prevents you from forgetting previously learned concepts

### 🕸️ **Tag Relationship Network**
CodeMaster uses pre-built relationships between coding concepts:
- **Arrays → Dynamic Programming** (natural progression)
- **Trees → Graphs** (related data structures)
- **Greedy → Graph algorithms** (technique connections)

This ensures your learning path makes logical sense rather than jumping randomly between unrelated topics.

### ⚙️ **Adaptive Session Length**
- **Adaptive Mode**: Session length adjusts based on your performance and focus
- **Manual Mode**: You set fixed session lengths (customizable in settings)
- **Smart Defaults**: System suggests optimal session sizes for your learning velocity

## Technical Implementation

### Core Components
- **SessionService** (`sessionService.js`): Creates and manages sessions
- **ProblemService**: Handles adaptive problem selection
- **Leitner System**: Manages spaced repetition scheduling
- **Tag Mastery Engine**: Tracks your progress through coding concepts

### Data Storage
All session data gets stored locally in your browser's IndexedDB:
- Session history and outcomes
- Individual problem attempts
- Performance analytics over time
- Mastery progression tracking

## Why This Approach Works

### 🎯 **Focused Learning**
The 5-tag focus window prevents the common problem of trying to learn too many concepts at once, which leads to confusion and poor retention.

### 🧩 **Connected Knowledge**  
By using actual problem relationships instead of random selection, you build a coherent understanding where concepts reinforce each other.

### 📊 **Data-Driven Adaptation**
Every decision is based on your actual performance data, not generic assumptions about what you should study next.

### 🔄 **Retention Optimization**
The Leitner system ensures you don't forget previously learned concepts while continuing to make progress on new material.

**The result: You learn coding patterns more efficiently and solve problems faster than with random practice.**

## Current Implementation Status
✅ **COMPLETED** - Full session system with adaptive algorithms implemented in `sessionService.js`