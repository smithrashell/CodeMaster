# 📓 Changelog

All notable changes to this project will be documented in this file.

## [0.8.5] - 2025-07-21
### Added
- **🛢️ Persistent Session Analytics Store**: Created dedicated IndexedDB store for historical session performance data
  - Added new `session_analytics` store (database version 24) with sessionId as primary key
  - Implemented comprehensive session analytics API with 6 specialized query functions
  - Created optimized indexes for date-based, accuracy-based, and difficulty-based queries
  - Enabled unlimited historical storage replacing 50-session Chrome storage limitation
  - Built automatic data retention and cleanup system for long-term maintenance

### Enhanced  
- **📊 Session Performance Data Persistence**: Enhanced `summarizeSessionPerformance()` to store analytics permanently
  - Integrated `storeSessionAnalytics()` for persistent storage of complete session summaries
  - Maintained Chrome storage as backup system while adding IndexedDB as primary storage
  - Preserved point-in-time mastery progression calculations for historical trend analysis
  - Added structured analytics data optimized for dashboard queries and visualization

### Technical Improvements
- **🗄️ Database Architecture Enhancement**: Extended storage infrastructure for advanced analytics
  - Upgraded database schema to version 24 with proper migration handling
  - Added comprehensive session analytics data model with performance metrics, mastery deltas, and insights
  - Implemented robust error handling and validation for analytics data storage operations
  - Created specialized query functions for date ranges, accuracy filtering, and recent sessions retrieval

### Analytics API Features
- **🔍 Advanced Query Capabilities**: Built comprehensive API for session analytics retrieval
  - `getSessionAnalyticsRange()` - Date-based queries for dashboard time series analysis
  - `getRecentSessionAnalytics()` - Recent sessions overview with configurable limits
  - `getSessionAnalyticsByAccuracy()` - Performance-filtered queries for trend analysis
  - `cleanupOldSessionAnalytics()` - Automated data retention with configurable cleanup periods
  - All functions include proper error handling, indexing optimization, and result sorting

### Dashboard Foundation
- **📈 Analytics-Ready Data Structure**: Prepared comprehensive data for advanced dashboard features
  - Pre-calculated performance metrics for fast dashboard loading (accuracy, timing, difficulty breakdown)
  - Historical mastery progression tracking with before/after state comparisons
  - Tag performance analysis with strong/weak identification and timing feedback
  - Session insights and recommendations stored for user feedback and progress tracking
  - Structured data format optimized for chart libraries and visualization components

### Bug Fixes
- **🧪 Test Environment Enhancements**: Fixed compatibility issues for reliable testing
  - Added `structuredClone` polyfill for Node.js test environment compatibility
  - Fixed missing variable declaration in IndexedDB problem_relationships store creation
  - Enhanced error handling and validation in session performance functions
  - Suppressed JSDOM navigation warnings for cleaner test output

### Future-Ready Architecture
- **🚀 Scalable Analytics Foundation**: Built extensible system for advanced analytics features
  - Established infrastructure for longitudinal learning insights and retention analysis
  - Created indexed data structure supporting complex dashboard queries and filters
  - Prepared foundation for machine learning insights and personalized recommendations
  - Designed for integration with advanced visualization libraries and analytics tools

## [0.8.4] - 2025-07-21
### Added
- **📊 Centralized Session Performance Summary**: Implemented comprehensive session analytics orchestration (Resolves #10)
  - Created `summarizeSessionPerformance(session)` function as single entry point for all post-session analysis
  - Consolidated existing logic from `calculateTagMastery()`, `updateProblemRelationships()`, and `getSessionPerformance()`
  - Added mastery progression delta calculations to track learning advancement and decay over time
  - Implemented session difficulty distribution analysis with percentages and predominant difficulty identification
  - Generated actionable insights with accuracy, efficiency, and mastery feedback plus next action recommendations

### Enhanced
- **🎯 Session Analytics Foundation**: Established structured logging and analytics infrastructure
  - Added comprehensive session analytics logging with JSON-formatted events for dashboard integration
  - Implemented Chrome storage integration for last 50 session analytics with automatic cleanup
  - Created helper functions for accuracy, efficiency, and mastery insight generation
  - Enhanced session completion flow with centralized performance tracking instead of scattered function calls

### Technical Improvements
- **🔧 Code Architecture**: Improved session lifecycle management and maintainability
  - Refactored `checkAndCompleteSession()` to use centralized performance analysis instead of individual function calls
  - Maintained existing integration points in `attemptsService.addAttempt()` with zero breaking changes
  - Added comprehensive error handling and logging throughout session performance pipeline
  - Implemented delta calculations for pre/post session tag mastery state comparison

### Analytics Features
- **📈 Performance Metrics**: Comprehensive session performance tracking capabilities
  - Tag accuracy and efficiency measurement across difficulty levels
  - Mastery progression tracking with new masteries and decay detection
  - Session difficulty mix analysis with counts, percentages, and predominant difficulty
  - Timing feedback analysis against expected time ranges for each difficulty level
  - Strong and weak tag identification for personalized learning recommendations

### Future-Ready Infrastructure
- Established foundation for longitudinal insights and retention analysis
- Prepared analytics data structure for advanced dashboard visualizations
- Created extensible architecture for additional performance metrics and insights
- Simplified debugging and testing through centralized session analysis logic

## [0.8.3] - 2025-07-21
### Fixed
- **🧹 ESLint Configuration Overhaul**: Completely refactored and balanced linting setup for improved developer experience (Resolves #13)
  - Fixed broken `no-direct-db-access` custom rule that was causing configuration errors
  - Resolved all critical `no-undef` errors by adding missing imports across codebase
  - Cleaned up hundreds of unused imports and variables with proper commenting for future use
  - Adjusted aggressive `max-lines-per-function` limit from 30 → 75 lines (100 for services/DB)
  - Added complexity-focused rules with realistic thresholds (15 base, 18-20 for business logic)
  - Implemented context-aware overrides for test files, service layer, and database operations

### Enhanced
- **🎯 Smart Linting Rules**: Balanced configuration prioritizing real issues over style noise
  - Added `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"` for intentional unused variables
  - Enhanced Chrome extension environment support with `webextensions: true` and proper globals
  - Integrated React Hooks linting with `eslint-plugin-react-hooks` for better hook usage validation
  - Replaced `console.log` statements with appropriate logging levels (`console.info`, `console.error`)
  - Added domain-specific import restrictions to encourage modular database access patterns

### Technical Improvements
- **📊 Linting Philosophy**: Established clear error vs warning categorization
  - **Errors**: Critical issues that break functionality (`no-undef`, `no-unused-vars`, `no-console`)
  - **Warnings**: Code quality suggestions (`complexity`, `max-lines-per-function`, `require-await`)
  - **Context-aware**: Relaxed rules for tests, stricter for production code
- **🔧 Developer Experience**: Reduced linting noise from 607 → 536 problems while improving accuracy
  - Fixed import resolution issues and undefined function references
  - Established consistent async/await patterns and Promise handling
  - Improved build stability with proper module exports and imports

### Code Quality Impact
- Maintained 100% test pass rate and successful builds throughout refactoring
- Reduced false positive warnings while surfacing legitimate code issues
- Established foundation for consistent code style without hindering productivity
- Improved onboarding experience by removing configuration barriers

## [0.8.2] - 2025-07-20
### Added
- **🧪 Core Test Infrastructure**: Established foundational testing tools for CodeMaster Chrome extension (Resolves #5)
  - Installed Jest, React Testing Library, and Jest Environment JSDOM for comprehensive testing
  - Created `jest.config.js` with Chrome extension and ES6/JSX support configuration
  - Built `test/setup.js` with global mocks for Chrome APIs (storage, runtime, tabs) and browser environment
  - Integrated fake-indexeddb for isolated IndexedDB testing without external dependencies
  - Added GitHub Actions workflow (`.github/workflows/test.yml`) for automated CI testing
  - Created example test files demonstrating session logic and database testing patterns
  - Updated package.json with test scripts: `test`, `test:watch`, `test:coverage`, `test:ci`

### Enhanced  
- **📚 Test Utilities**: Comprehensive testing helpers and mock factories
  - Custom render function with Mantine provider integration for React component testing
  - Mock factories for session, problem, and tag mastery data structures
  - Chrome extension API helpers with storage and runtime mocking utilities
  - Test assertion helpers for validating data structure integrity
  - IndexedDB mock utilities for database operation testing

### Technical Improvements
- **🔧 Development Workflow**: Updated CLAUDE.md with testing commands and best practices
- **🚀 CI/CD Integration**: Automated testing on push/PR with coverage reporting via Codecov
- **🛡️ Environment Simulation**: Complete browser and Chrome extension environment mocking
- **📊 Coverage Reporting**: Configured coverage thresholds and reporting for maintainable code quality

### Testing Foundation
- Enables reliable testing of session creation, tag mastery progression, and user settings persistence
- Supports future development with isolated, reproducible test environment
- Prevents regressions as system complexity increases through automated testing
- Provides patterns for testing Chrome extension APIs and IndexedDB operations

## [0.8.1] - 2025-07-18
### Refactored
- **🏗️ Session Orchestrator Refactoring**: Completed modularization of `getOrCreateSession()` function
  - Extracted `resumeSession()` → Dedicated function for handling existing in-progress sessions
  - Extracted `createNewSession()` → Focused function for new session creation and persistence
  - Simplified `getOrCreateSession()` → Clean orchestrator that delegates to specialized functions
  - Improved separation of concerns and testability across session lifecycle management

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

