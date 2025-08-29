# 🧠 CodeMaster: Chrome Extension Documentation

> **Algorithm Mastery Through Intelligent Spaced Repetition**

CodeMaster is a Chrome extension that transforms how developers learn data structures and algorithms. Using sophisticated FSRS (Forgetting Spaced Repetition Scheduling) and pattern-based learning, it creates personalized study sessions that adapt to your progress and optimize long-term retention.

## 🎯 Project Status

**Current Version**: v0.8.6  
**Launch Status**: Ready for Chrome Web Store (pending Strategy Map feature)  
**Core Engine**: ✅ Complete and functional  
**Missing**: Strategy Map user guidance layer

---

## 📋 Quick Navigation

### 📊 Project Overview
- **[Kanban Board](Board/Code%20Master.md)** - Current project status and task tracking
- **[Project Outline](Resources/Project%20outline/Project%20outline.md)** - Core vision and goals
- **[MVP Requirements](Resources/Project%20outline/MVP.md)** - Essential features for launch

### 🗺️ Strategy Map (Priority Feature)
- **[Strategy Map Overview](Resources/StrategyMap/Feature%20Idea.md)** - Complete feature specification
- **[Implementation Plan](Resources/StrategyMap/Implementation.md)** - Technical implementation guide
- **[Strategy Map Technical Specs](Resources/StrategyMap/Technical%20Specs.md)** - Detailed technical requirements
- **[User Experience Design](Resources/StrategyMap/User%20Experience.md)** - How users interact with the feature

### 🏗️ Technical Architecture
- **[Data Storage](Resources/Data%20Storage/Data%20Storage.md)** - IndexedDB structure and design
- **[Learning Algorithm](Resources/Review%20Schedule/Learning%20Algorithm%20FSRS.md)** - FSRS implementation details
- **[Session System](Resources/Sessions/Sessions.md)** - Adaptive session generation
- **[Tag Generation](Resources/Tag%20Generation/Tag%20Generation.md)** - Problem classification system

### 🎨 User Interface
- **[Dashboard](Resources/Dashboard/Dashboard.md)** - Analytics and progress visualization
- **[Problem Capture](Resources/Problem%20Capture%20and%20Timer/Problem%20Capture%20and%20Timer.md)** - Core interaction system
- **[Statistics](Resources/Statistics/Statistics.md)** - Performance tracking and metrics

### 🚀 Development
- **[Implementation Roadmap](Board/Implementation%20Roadmap.md)** - Development phases and milestones
- **[Bug Tracking](Resources/Bugs/)** - Known issues and solutions
- **[Deployment](Resources/Deployment/Deployment.md)** - Chrome Web Store preparation

---

## 🎯 Current Focus: Strategy Map Feature

**Why Strategy Map is Critical**: Your sophisticated adaptive learning engine works perfectly but is invisible to users. The Strategy Map makes your intelligent system understandable and valuable.

**What it provides**:
- 📍 Visual tier progression (Core → Fundamental → Advanced)
- 🎯 Tag mastery progress visualization
- 💡 Educational primers explaining algorithm patterns
- ❓ Problem selection transparency ("Why this problem?")
- 💭 Strategic hints during problem solving

**Impact**: Transforms CodeMaster from "another problem scheduler" to "intelligent learning companion"

---

## 📈 Implementation Status

### ✅ Fully Implemented
- **FSRS Learning Algorithm** - Complete spaced repetition system
- **Adaptive Session Generation** - Intelligent problem selection
- **Tag Mastery System** - Pattern learning progression
- **IndexedDB Data Layer** - Persistent storage and analytics
- **Chrome Extension Integration** - Content scripts and background service
- **Dashboard Analytics** - Progress visualization and metrics
- **Testing Infrastructure** - Comprehensive test coverage

### 🟡 Partially Implemented
- **UI Polish** - Some placeholder content remains
- **Advanced Statistics** - Additional metrics and insights
- **Error Handling** - Could be more comprehensive

### ❌ Missing (Launch Blockers)
- **Strategy Map Feature** - The critical user guidance layer
- **Chrome Store Assets** - Screenshots, descriptions, privacy policy

---

## 🧭 Learning Philosophy

CodeMaster is built on several key principles:

1. **Spaced Repetition Mastery** - Using FSRS algorithm for optimal retention
2. **Pattern-Based Learning** - Focus on algorithmic patterns vs individual problems  
3. **Adaptive Difficulty** - Progressive scaling based on performance
4. **Relationship-Aware** - Problems connected through tag relationships
5. **Long-term Retention** - Optimizing for career-long knowledge retention

---

## 🔍 Quick Reference

### Key Technologies
- **Frontend**: React, Mantine UI, Recharts
- **Storage**: IndexedDB, Chrome Storage API
- **Testing**: Jest, React Testing Library
- **Build**: Webpack, Babel
- **Extension**: Manifest v3, Content Scripts

### Core Data Structures
- **Problems**: Algorithm problems with metadata
- **Attempts**: User solution attempts and performance
- **Sessions**: Structured learning sessions
- **Tag Mastery**: Progress tracking per algorithm pattern
- **Pattern Ladders**: Progressive difficulty sequences

### Development Commands
```bash
npm run dev        # Development server
npm run build      # Production build
npm run test       # Run test suite
npm run lint       # Code quality check
```

---

## 📚 Additional Resources

- **[Food for Thought](Board/Food%20For%20Thought.md)** - Strategic considerations and insights
- **[What I Could Be Missing](Board/What%20I%20could%20be%20Missing.md)** - Potential blind spots and improvements
- **[Bottleneck Analysis](Board/✻%20Bottle%20Neck%20potential.md)** - Performance and scalability considerations

---

*Last Updated: July 28, 2025*  
*For questions or contributions, see the development workflow in the Board section.*