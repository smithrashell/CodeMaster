# Changelog

All notable changes to CodeMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added independent time range filters to Progress page charts (#172)
  - Each chart has its own filter dropdown in the chart card header
  - "New vs Review Problems per Session" chart has its own time range filter
  - "Problem Activity per Session" chart has its own time range filter
  - Filter options: Last 7 days, Last 30 days, Quarter to date, Year to date, All time
  - Works client-side on already-loaded data (instant filtering, no refresh needed)
  - Same pattern as Session History page for consistency

### Fixed
- Fixed Focus Areas showing 'array' tag instead of empty state when no focus area is selected (#173)
  - Changed default `focusAreas` from `["array"]` to `[]` for new users
  - Removed silent hardcoded fallbacks that hid data integrity issues
  - System now throws explicit errors when focus tag generation fails (instead of hiding problems)
  - Empty focus areas now display "No focus areas selected" in UI
  - System automatically recommends focus areas based on learning state when user has no manual selection
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
