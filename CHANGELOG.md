# Changelog

All notable changes to CodeMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed Promotion & Demotion Trends chart showing "No Data to display" despite completed review sessions (#172)
  - Fixed property name case mismatches in `generatePromotionDataFromSession.jsx`
  - Now supports both snake_case (`problem_id`, `attempt_date`, `success`) and PascalCase (`ProblemID`, `AttemptDate`, `Success`)
  - Fixed problem metadata property access (`tags`/`Tags`, `rating`/`Rating`)
  - Chart now correctly displays weekly promotion/demotion trends based on spaced repetition box level changes
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
