# Changelog

All notable changes to CodeMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Today's Progress Summary**: Replaced broken Daily Missions system with real-time daily statistics component (#175)
  - New TodaysProgressSection.jsx displays live stats for today's activity
  - Shows problems solved, accuracy percentage, review problems completed, hint efficiency, and average time per problem
  - Reads from attempts store directly to include current active session data
  - Stats update immediately as user completes each problem (true real-time)
  - No caching, no delays - reflects exact current state
  - Provides at-a-glance view of daily progress without gamification overhead

### Fixed
- **Fixed onboarding modal text visibility in dark mode** (#194)
  - **Dashboard onboarding (WelcomeModal.jsx)**:
    - Modal now has proper dark mode styling with dark background (#1a1b1e) and light text (#ffffff)
    - Added theme-aware styling using Mantine Styles API (following CLAUDE.md guidelines)
    - Fixed hardcoded light blue Card background in "Key Insight" section
    - Dark mode Card uses darker blue background (#1e3a8a) with lighter blue text (#93c5fd)
  - **Content onboarding tour (ContentOnboardingTour.jsx)**:
    - Fixed Card background color to dark theme (#1a1b1e) in dark mode
    - Fixed title text color from forced black (#1a1a1a) to white (#ffffff) in dark mode
    - Fixed content text color to light gray (#c9c9c9) in dark mode
    - Fixed progress bar background to dark gray (#373a40) in dark mode
    - Fixed arrow pointer color to match card background in both themes
    - Removed hardcoded `!important` black text that broke dark mode
  - Both onboarding systems now fully readable in light and dark modes
- Fixed Daily Missions system complete non-functionality (#175)
  - Daily Missions were completely broken: tracking incorrect data, showing random percentages, not updating
  - Mission types (perfectionist, speed demon, etc.) had arbitrary requirements that didn't align with learning methodology
  - Replaced entire system with simpler Today's Progress Summary (see Added section)
  - Removed DailyMissionsSection.jsx, useMissions.js, and missionHelpers.js
- Fixed critical settings persistence bugs on Goals page (#175)
  - Session length was not persisting when navigating away from Goals page
  - Fixed stale closure bug using refs pattern (same issue as #162)
  - Session length changes now save and load correctly across page navigation
  - Changed default session length from hardcoded `5` to `"auto"` (system-controlled based on due reviews)
  - Updated all fallback cases across initialize-settings.js, storageService.js, and dashboardService.js
- Fixed guardrails not loading from saved settings (#175)
  - Max new problems (maxNewProblems) was loading hardcoded defaults instead of saved values
  - GuardrailsSection.jsx now properly loads persisted settings on mount
  - Removed obsolete guardrail fields from code (minReviewRatio, reviewRatio)
- Fixed tag mastery records not updating after completing problems (#175)
  - Tag mastery was stuck at 0 attempts due to IndexedDB transaction timeout error
  - Root cause: Calling getLadderCoverage() inside tag_mastery transaction caused original transaction to auto-commit
  - Solution: Pre-fetch all ladder coverage data BEFORE starting tag_mastery transaction
  - Tag mastery now updates correctly when users complete sessions
- Fixed tag mastery lazy initialization to enable unknown tag exploration bonus (#175)
  - Removed insertDefaultTagMasteryRecords() pre-population that created records for ALL tags during onboarding
  - Restored lazy initialization: tag mastery records now created organically on first attempt
  - Enables proper differentiation in problem selection algorithm:
    - Unknown tags (no record): 1.2x exploration bonus
    - New tags (record with <3 attempts): 1.4x exploration bonus
  - Previously all tags had records after onboarding, breaking unknown tag bonus logic
- Fixed Today's Progress timezone issue causing incorrect daily stats (#175)
  - Date filtering was using UTC timezone instead of user's local timezone
  - Attempts crossing midnight UTC were incorrectly split across different days
  - Now uses local timezone for accurate "today" filtering
  - Also fixed success field comparison to handle both boolean (true) and numeric (1) values
- Fixed theme reversion bug when navigating between pages (#174)
  - Theme changes now persist immediately using localStorage for instant synchronization
  - Added timestamp-based conflict resolution to prevent stale Chrome storage from overriding recent changes
  - Chrome storage and localStorage stay in sync via timestamp comparison
  - Prevents race condition where async Chrome storage save could revert theme after navigation
  - Works across both dashboard and content pages
- Fixed badge text color visibility on Goals page (#174)
  - Modified CSS selector to exclude badges from Card dark text override
  - Changed `.mantine-Card-root span` to `.mantine-Card-root span:not(.mantine-Badge-root):not(.mantine-Badge-label)`
  - Badge text now displays properly in white on colored backgrounds (cyan, violet, teal)
  - Removed need for inline style workarounds
- Fixed guardrails validation issues on Goals page (#174)
  - Max new problems dropdown now dynamically limits options based on session length
  - Prevents confusing state where max new problems can exceed total session length
  - Auto-adjusts max new problems when session length changes to a lower value
  - Shows helpful text indicating the session length constraint
  - Example: With session length = 5, dropdown only shows options 2-5 (not 8 or 10)
- Replaced confusing adaptive difficulty toggle with informational alert (#174)
  - Removed non-functional "Enable adaptive difficulty progression" toggle
  - Adaptive difficulty is always active via escape hatches (cannot be disabled)
  - New informational Alert explains adaptive difficulty is automatic
  - Clearer UX that doesn't suggest a choice where none exists

### Removed
- Removed artificial review ratio sliders that conflicted with Leitner system (#174)
  - Removed "Min review ratio" slider from Guardrails section
  - Removed "Review ratio" slider from Focus Priorities section
  - Leitner spaced repetition system now naturally determines review problem count
  - Review problems appear based on when they're due, not arbitrary percentage targets
  - Session composition: ALL due review problems (up to session length) + remaining slots filled with new problems
  - Example: If 3 problems are due for review, session includes all 3 (not capped by percentage)
  - Prevents artificial caps that would skip due review problems
  - Aligns with proper spaced repetition methodology
- Removed non-functional difficulty distribution display (#174)
  - Removed "Difficulty distribution" display from Focus Priorities section
  - Was read-only, not editable by users
  - Setting was saved but never actually used
  - Adaptive difficulty escape hatch system automatically handles Easy → Medium → Hard progression
  - Removed confusing display that suggested user control where none existed

### Changed
- **Disabled all caching to eliminate stale data bugs** (#175)
  - Frontend cache in useChromeMessage.js is now disabled (cache disabled by default)
  - Background script cache in background/index.js is now disabled
  - Removed all cache clearing calls throughout codebase (no longer needed)
  - System now fetches fresh data on every request (slight performance tradeoff for data consistency)
  - Created issue #188 to track complete removal of cache code in future refactor
  - Prevents settings persistence bugs, stale UI data, and confusing user experiences

### Added
- Added independent time range filters to Progress page charts (#172)
  - Each chart has its own filter dropdown in the chart card header
  - "New vs Review Problems per Session" chart has its own time range filter
  - "Problem Activity per Session" chart has its own time range filter
  - Filter options: Last 7 days, Last 30 days, Quarter to date, Year to date, All time
  - Works client-side on already-loaded data (instant filtering, no refresh needed)
  - Same pattern as Session History page for consistency

### Added
- **Pattern Ladder Coverage Mastery Gate**: Tags now require 70% pattern ladder completion for mastery
  - Ensures exposure to diverse problem patterns, not just volume
  - Pattern ladders follow natural difficulty distribution (prevents Easy-only mastery)
  - Covers both pattern diversity AND difficulty breadth in a single gate
  - New 4-gate system: Volume (attempts) + Variety (unique problems) + Accuracy (success rate) + Ladder Coverage (pattern exposure)
  - Console logs now show ladder progress: `ladder: ✅ 9/12 (75%/70%)`

### Fixed
- Fixed duplicate session creation on database initialization
  - Race condition in sessionCreationLocks allowed two simultaneous requests to both create sessions
  - Lock was being set AFTER async promise creation, leaving window for duplicates
  - Now sets lock IMMEDIATELY before any async work to prevent race condition
  - Fixes issue where two identical sessions would be created ~100ms apart after DB reset
- Fixed Focus Areas showing 'array' tag instead of empty state when no focus area is selected (#173)
  - Changed default `focusAreas` from `["array"]` to `[]` for new users across all initialization paths
  - Updated storageService.js, onboardingService.js, and initialize-settings.js to use empty array
  - Updated dashboardService.js fallbacks to use empty array instead of `["array"]`
  - Removed silent hardcoded fallbacks that hid data integrity issues
  - System now throws explicit errors when focus tag generation fails (instead of hiding problems)
  - Empty focus areas now display "No focus areas selected" in UI
  - System automatically recommends focus areas based on learning state when user has no manual selection
- Fixed coreLadder remnants from deprecated architecture decision (Sept 2025)
  - Removed coreLadder writes from problemladderService.js (was writing unused data to tag_mastery)
  - Removed coreLadder schema from DataIntegritySchemas.js
  - pattern_ladders store is the single source of truth for ladder data
  - Eliminated data duplication and stale data issues
- Fixed Progress page charts showing aggregated data instead of per-session data (#172)
  - Replaced "Promotion & Demotion Trends" with "New vs Review Problems per Session" stacked bar chart
  - Changed "Problem Activity Over Time" to "Problem Activity per Session" showing individual session bars
  - Both charts now display individual sessions as data points (matching Overview page pattern)
  - Each session shows as its own bar instead of being aggregated by week/month/year
  - Added `getNewVsReviewProblemsPerSession()` function to show breakdown of new vs review problems per session
  - Added `getIndividualSessionActivityData()` function for per-session activity metrics
- Fixed Learning Efficiency chart showing "No Data" despite having completed sessions (#163)
- Fixed property name mismatches: Changed all `session.Date` (PascalCase) to `session.date` (lowercase) across 12 locations
  - dashboardService.js: 9 instances (lines 148, 729, 756, 1264, 1288, 1294, 1397, 1416, 1435)
  - DataAdapter.js: 3 instances (lines 135, 212, 287)
  - focusAreaHelpers.js: 1 instance (line 58)
- Fixed streak calculation not sorting sessions correctly due to undefined date property
- Fixed focus area date range filtering failing due to property mismatch
- Fixed inverted efficiency formula inconsistency between Overview and Session History pages
- Fixed Accuracy Trend chart showing only 2 aggregated data points instead of individual sessions

### Changed
- **Breaking Change**: Charts now show individual session data instead of weekly/monthly/yearly aggregations
  - Each completed session appears as its own data point on charts
  - Time range filter now controls which sessions are displayed (not how they're grouped)
  - Session Accuracy: Shows accuracy % for each individual session
  - Learning Efficiency: Shows hints per problem for each individual session
- Changed Learning Efficiency metric from "problems per hint" to "hints per problem" for better UX
  - Lower values now indicate better efficiency (0.0 = perfect, no hints needed)
  - Metric is more intuitive: "2.5 hints per problem" vs confusing "0.4 problems per hint"
  - Tooltip now displays "Lower is better" to guide users
- Removed "Primer" from Hints Used breakdown (primers are educational content, not tracked as interactive hints)

### Removed
- Removed Time Accuracy placeholder metric from Average Time Per Problem card
  - Was showing random values (75-95%) with no real calculation
  - Proper implementation requires tracking recommended time limits at attempt creation
  - Created Issue #180 to document full implementation requirements

### Added
- Added `enrichSessionsWithHintCounts()` function to populate real hint usage data from `hint_interactions` table
  - Sessions now have `hintsUsed` property with actual count from database
  - Replaced estimation formula with real interaction data
  - Parallel processing with `Promise.all()` for performance
- Added time range filter to Overview page that now applies to both charts AND KPI cards (#171)
  - Options: "Last 7 days", "Last 30 days", "Quarter to date", "Year to date", "All time"
  - Filter applies to Accuracy and Learning Efficiency charts
  - Filter also recalculates KPI metric cards (Total Problems Solved, Average Time, Success Rate, Hints Used)
  - New `recalculateKPIsFromSessions()` function in useStatsState.js
  - KPIs dynamically update based on filtered session data
- Added individual session efficiency calculation in DataAdapter
  - New function: `getIndividualSessionEfficiencyData()`
  - Calculates efficiency per session: `hintsUsed / successfulProblems`
  - Sessions with zero hints show as 0.0 efficiency (perfect score)

### Technical
- Updated test `dashboardService.test.js` to expect `hintsUsed` property on enriched sessions
- All tests passing (33 test suites, all passed)
- No ESLint errors (7 minor warnings about function length)

## Previous Changes

See git commit history for changes prior to this changelog.
