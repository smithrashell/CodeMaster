# 📓 Changelog

All notable changes to this project will be documented in this file.

## [0.8.0] - 2025-07-17
### Refactored
- **🏗️ Session Logic Architecture Overhaul**: Complete refactoring of session creation logic into modular 3-layer architecture
  - `createSession()` → High-level coordinator for clean session orchestration
  - `buildAdaptiveSessionSettings()` → Dedicated adaptive sizing and difficulty logic
  - `fetchAndAssembleSessionProblems()` → Intelligent problem assembly with 40/60 review/new distribution
  - Eliminated monolithic `fetchProblemsForSession()` with 5+ responsibilities

### Enhanced
- **🎯 Difficulty Progression System**: Fixed and enhanced difficulty cap advancement
  - Easy → Medium progression at 90% accuracy (existing)
  - Medium → Hard progression at 90% accuracy (newly added)
  - Progressive unlocking with debug logging for better user feedback
  - Complete difficulty scaling from Easy through Hard based on performance

- **⚙️ Settings Management**: Migrated settings from Chrome storage to IndexedDB
  - Added dedicated `settings` store to IndexedDB schema (database version 23)
  - Updated `StorageService` to use IndexedDB for persistent settings storage
  - Implemented automatic migration from Chrome storage to IndexedDB
  - Preserved backward compatibility with seamless user experience
  - Settings now stored alongside other persistent data for consistency

- **🔄 Session State Management**: Implemented proper IndexedDB session state handling
  - Added `getSessionState()` and `setSessionState()` methods to StorageService
  - Migrated session state from Chrome storage to dedicated `session_state` IndexedDB store
  - Updated `buildAdaptiveSessionSettings()` and `resetTagIndexForNewWindow()` to use IndexedDB
  - Automatic migration of existing session state data for seamless transition
  - Consistent data persistence across all application components

### Fixed
- **🔧 Legacy Code Cleanup**: Removed obsolete and commented code blocks
  - Removed 90+ lines of commented `fetchProblemsForSession()` code in problemService.js
  - Identified and documented legacy background3.js file status
  - Cleaned up code structure for better maintainability

### Technical Improvements
- **📊 New User Experience**: Enhanced session creation for users with no review problems
  - Automatic 0/100 review/new split for new users (instead of failed 40/60 split)
  - Graceful fallback mechanisms ensure full sessions of new problems for onboarding
  - Progressive adaptation to 40/60 split as users build review history

- **🎯 Problem Selection Logic**: Simplified tag expansion for better predictability
  - Replaced complex `getRelatedTagsForExpansion()` with simple `focusTags[1]` selection
  - More predictable progression through focus tags in natural order
  - Reduced complexity and improved maintainability of problem selection algorithm
  - Removed unused relationship-based expansion logic for cleaner codebase

- **🔗 Import/Export Validation**: Verified all function imports and exports work correctly
  - Confirmed `buildAdaptiveSessionSettings()` integration across services
  - Validated `fetchAndAssembleSessionProblems()` accessibility and parameters
  - Ensured clean separation of concerns between session lifecycle and problem selection

### Architecture Benefits
- **🧪 Improved Testability**: Individual functions can now be tested in isolation
- **🔄 Enhanced Reusability**: Session components available for different flows (onboarding, review-only mode)
- **📈 Better Maintainability**: Clear single-responsibility functions replace complex monolithic logic
- **🚀 Future Extensibility**: Modular architecture enables easier feature additions and modifications

---

## [0.7.0] - 2025-07-16
### Added
- **🧠 Intelligent Problem Selection System**: Complete overhaul of problem selection with relationship-based expansion
  - Primary focus (60%) on user's weakest tag for deep learning
  - Related tag expansion (40%) using tag relationships for connected learning
  - Progressive difficulty scaling based on user performance and attempts
  - Tag relationship utilization for intelligent concept progression

- **🎓 Smart Focus Tag Management**: Enhanced tag selection and graduation system
  - Intelligent focus tag selection based on learning efficiency and relationships
  - Automatic tag graduation when 3+ tags are mastered (80%+ success rate)
  - Relationship-based new tag selection for seamless learning progression
  - Learning velocity tracking for optimal tag prioritization

- **📈 Progressive Tag Expansion**: Dynamic tag exposure scaling beyond 3 tags
  - Performance-based tag count (90%+ accuracy: 3 tags, 75%+: 2 tags, <75%: 1 tag)
  - Experience-based bonus tags (10+ sessions: +1 tag, 20+ sessions: +2 tags)
  - Unlimited progressive expansion (up to 8 tags max) based on session count
  - Optimal learning zone targeting (40-70% success rate for maximum growth)

- **🔄 Enhanced Session Distribution**: Improved problem composition for balanced learning
  - 40% review problems for spaced repetition and retention
  - 60% new problems split between focus and expansion tags
  - Fallback mechanisms to ensure sessions are always complete
  - Intelligent deduplication and problem sequencing

- **🛡️ Robust Onboarding System**: Strengthened new user experience
  - Enhanced fallback mechanisms for empty focus tags and mastery data
  - Safe default tag selection for brand new users
  - Progressive difficulty allowance (Easy: 100%, Medium: 80% for new users)
  - Comprehensive error handling for edge cases

### Enhanced
- **⚡ Difficulty Allowance System**: Refined progressive scaling algorithm
  - Smooth progression from Easy → Medium → Hard based on performance
  - Confidence-based difficulty unlocking (85%+ for Medium, 90%+ for Hard)
  - Experience-weighted requirements (more attempts needed for harder problems)
  - Granular allowance weights (0.4-1.0) instead of binary access

- **🎯 Session Settings**: Adaptive session configuration improvements
  - Dynamic tag count calculation based on accuracy and efficiency
  - Session-based progression tracking for tag exposure
  - Optimal cognitive load management to prevent overwhelming users
  - Conservative onboarding with gradual complexity increase

### Fixed
- **🔧 Function Integration**: Resolved recursive function call in `updateProblemsWithRatings()`
- **🔧 Import Issues**: Fixed missing imports and function references across all modified files
- **🔧 Async/Await**: Ensured proper async handling in all new functions
- **🔧 Data Structure**: Validated all integration points between services

### Changed
- **📊 Problem Selection Algorithm**: Completely rewritten for intelligent learning paths
- **🏷️ Tag Management**: Enhanced from simple performance-based to relationship-aware selection
- **📚 Learning Progression**: Shifted from fixed 3-tag limit to dynamic expansion system
- **🎨 Session Assembly**: Improved from basic review/new split to intelligent distribution

### Technical Improvements
- Added `selectProblemsForTag()` for tag-specific problem selection with progressive difficulty
- Added `getRelatedTagsForExpansion()` for intelligent tag relationship expansion
- Added `calculateTagIndexProgression()` for focus window progression (replaces unlimited expansion)
- Added `getIntelligentFocusTags()` for smart focus tag selection and graduation
- Added `resetTagIndexForNewWindow()` for focus window cycling
- Enhanced `fetchAdditionalProblems()` with primary focus and expansion logic
- Improved `getDifficultyAllowanceForTag()` with granular progressive scaling

### Fixed Design Implementation
- **🔧 Focus Window Logic**: Corrected tag expansion to work within 5-tag focus windows instead of unlimited growth
- **🔧 tagIndex System**: Implemented proper tagIndex progression (0-4) within current focus window
- **🔧 Window Cycling**: Added automatic tagIndex reset when graduating to new focus tag sets
- **🔧 Graduation Threshold**: Changed to 4/5 tags mastered for more appropriate window transitions

---

## [0.6.0] - 2025-04-28
### Added
- #BugFix :  new problems in session are bring pulled from problem relationship instead of standard problems

---

## [0.5.0] - 2025-04-17
### Added
- Strategy map page for tag classification and prioritization
- Goal tracking page stub with construction notice
- README.md and CHANGELOG.md created
- Added `getProblemActivityData()` to analyze promotions/demotions over time

---

## [0.4.0] - 2025-03-10
### Added
- Adaptive session generation using tag performance
- Integrated pattern-aware logic in session creation
- Support for prioritizing unattempted problems

### Changed
- Refactored `fetchAdditionalProblems()` to use pattern ladders
- Updated session generator to balance review and new problems

### Fixed
- Fixed issue with future dates appearing in charts
- Removed double-counting of boxLevel changes

---

## [0.3.0] - 2025-02-14
### Added
- Dashboard UI with box distribution and tag mastery charts
- Promotion/demotion logic using boxLevel change history
- Basic pattern_ladders and tag_mastery system

---

## [0.2.0] - 2025-01-10
### Added
- Implemented problem submission form and storage of success/timeSpent
- Basic Leitner System box logic
- Basic session scheduling and adaptive review selection

---

## [0.1.0] - 2024-12-01
### Added
- Initial setup for CodeMaster project
- Started Chrome Extension with LeetCode overlay
- Integrated IndexedDB for persistent problem storage

