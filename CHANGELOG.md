# Changelog

All notable changes to CodeMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Enhanced "I'm Stuck" Button** (#234)
  - Now extends timer by 5 minutes when clicked
  - Automatically opens hints panel to help user get unstuck
  - Records user intent for session analytics

### Fixed
- **Problem List Not Updating After Submission**
  - Fixed problems not being removed from generator list after submitting a solution
  - Root cause: Sidebar unmounting fix (Dec 23) prevented natural data refresh on remount
  - Added `problemSubmitted` message listener that triggers session refresh from database
  - Exposed `triggerSessionLoad` from `useSessionLoader` to enable on-demand refresh

- **Attempts Not Associated With Current Session**
  - Fixed attempts being recorded to old sessions instead of the current active session
  - Root cause: `getLatestSessionByType` returned arbitrary session when multiple exist with same type/status
  - Now properly sorts all matching sessions by date to return the most recent one

- **Settings Display Issues**
  - Fixed Time Limits segmented control not highlighting selected value (case sensitivity mismatch)
  - Fixed Focus Areas showing all 5 pool tags instead of performance-limited selection

- **Timer Settings Not Applying** (#234)
  - Fixed timer limits (Auto/Off/Fixed) not updating after changing settings
  - Added cache clearing for adaptiveLimitsService when settings are saved
  - Timer now listens for Chrome storage changes to refresh limits in real-time

- **Sidebar Form State Lost on Close** (#234)
  - Fixed form data being reset when closing and reopening sidebar
  - Changed ProblemTime, ProblemStats, Settings, and ProblemGenerator to use CSS display instead of unmounting
  - State now persists across sidebar open/close cycles

- **useStrategy Infinite Loop** (#234)
  - Fixed hook causing constant re-renders and console spam
  - Stabilized loadStrategyData callback with proper dependency management

- **Timer "Still Working" Prompt UI** (#234)
  - Redesigned from full-width banner to centered modal popup
  - Reduced countdown overlay text size from 8rem to 1.5rem
  - Fixed button click handlers not responding

### Changed
- **Codebase Cleanup**
  - Deleted unused popup files (popup.html, popup.js, popup.jsx) - extension uses dashboard directly
  - Deleted duplicate `sessionsPerformance.js` (sessionPerformanceHelpers.js is the used file)
  - Deleted `dashboardService.js.backup` leftover file
  - Fixed gitignore to exclude screenshots folder (case-sensitivity issue)
  - Updated components to use CSS variables for dark mode support
  - Updated CLAUDE.md with theming guidelines

### Tests
- Added regression test for timer settings cache clearing
- Added regression tests for cross-context theme sync
- Added comprehensive tests for `ProblemGeneratorHooks` message listeners
  - Tests for `sessionCacheCleared` message handling
  - Tests for `problemSubmitted` session refresh triggering
  - Tests for Chrome API availability edge cases

---

## [1.1.0] - Post Chrome Web Store Release

All changes after the Chrome Web Store release on November 19th, 2025.

### Added
- **Intelligent Recalibration System - Phase 1: Passive Background Decay** (#206)
  - Implemented time-based decay for users returning after long breaks
  - Added last activity date tracking to StorageService
  - Created RecalibrationService with passive decay algorithm (1 box per 60 days)
  - Enhanced FSRS to consider time elapsed with forgetting curve
  - Integrated passive decay on app startup (non-blocking, silent)
  - Added database fields for recalibration tracking
  - Prevents "fail-fest" experience for returning users (6+ month gaps)

- **Intelligent Recalibration System - Phase 2: Welcome Back Modal** (#206)
  - Gap-based recalibration strategy detection (gentle/moderate/major)
  - Created WelcomeBackModal component with strategy-specific messaging
  - Created useWelcomeBack hook for modal state management
  - Modal only shows once per return (dismissal persists)

- **Intelligent Recalibration System - Phase 3: Diagnostic Session** (#206)
  - 5-problem diagnostic session for comprehensive skill assessment
  - Topic-based recalibration with 70% accuracy threshold
  - Conservative recalibration (reduces box level by 1 for failed problems)

- **Intelligent Recalibration System - Phase 4: Adaptive First Session** (#206)
  - Performance-based decay adjustment system
  - Smart decay adjustment based on accuracy (70%+, 40-70%, <40%)

- **Open Source Licensing with Dual Licensing Option** (#206)
  - Established CodeMaster as open source under GNU AGPL v3
  - Created comprehensive LICENSE file
  - Added Contributor License Agreement (CLA) to CONTRIBUTING.md

- **Real Strategy Success Rate Calculation** (#184)
  - Replaced mock data with real calculation for Progress page Strategy Success metric

- **Learning Efficiency Analytics Score Explanations** (#190)
  - Added score range explanations (0-30, 30-60, 60+)

- **Today's Progress Summary** (#175)
  - Real-time daily statistics component replacing broken Daily Missions
  - Shows problems solved, accuracy, review problems, hint efficiency, avg time

- **Independent Time Range Filters** (#172)
  - Each Progress page chart has its own filter dropdown
  - Filter options: Last 7 days, Last 30 days, Quarter to date, Year to date, All time

- **Pattern Ladder Coverage Mastery Gate**
  - Tags now require 70% pattern ladder completion for mastery
  - New 4-gate system: Volume + Variety + Accuracy + Ladder Coverage

### Fixed
- **Reduced ESLint Warnings from 22 to 0** (#211)
- **Fixed CSS Scoping for Content Scripts** (#153) - Prevented extension styles from bleeding into host pages
- **Fixed Dashboard Card Styling and [object Object] Bug** (#234) - Added dashboard.css, fixed card rendering
- **Fixed Missing getAllProblems Method** (#216) - Added method to ProblemService
- **Fixed Goals page calculations** (#201) - Weekly accuracy, problems per week targets
- **Fixed dashboard text visibility in light/dark modes** (#194)
- **Fixed onboarding modal text visibility in dark mode** (#194)
- **Fixed extension context error dialog UX** (#195)
- **Fixed Learning Efficiency and Knowledge Retention showing 0** (#196)
- **Fixed critical settings persistence bugs on Goals page** (#175)
- **Fixed tag mastery records not updating** (#175)
- **Fixed theme reversion bug when navigating** (#174)
- **Fixed badge text color visibility on Goals page** (#174)
- **Fixed Progress page charts showing aggregated data** (#172)
- **Fixed Learning Efficiency chart showing "No Data"** (#163)
- **Fixed duplicate session creation race condition**
- **Fixed Focus Areas showing 'array' tag** (#173)
- **Fixed Chrome Web Store Permissions Violation** (Purple Potassium)
- **Fixed Dashboard Auto-Open on Extension Install**
- **Fixed Timer Behavior metric inconsistency** (#183)
- **Fixed XSS Security Vulnerability in Error Notifications** (#205)
- **Fixed Help Navigation Blank Page Bug**
- **Fixed Mastery Gates Test with Pattern Ladder Initialization** (#205)

### Changed
- **Documentation Updates** (#213)
  - Removed "Planned Features" section from main README
  - Created `github-assets/` folder for GitHub-visible screenshots
  - Updated all placeholder GitHub URLs to `smithrashell/CodeMaster`
  - Removed outdated `docs/archive/` folder
  - Updated IndexedDB store count from 13 to 17
  - Updated database version from 25 to 36

- **Charts now show individual session data** instead of weekly/monthly aggregations
- **Learning Efficiency metric** changed from "problems per hint" to "hints per problem"
- **Disabled all caching** to eliminate stale data bugs (#175)

### Removed
- **Removed non-functional Mistake Analysis page** (#190)
- **Removed artificial review ratio sliders** (#174)
- **Removed non-functional difficulty distribution display** (#174)
- **Removed all cache-related dead code** (#188) - ~300 lines removed
- **Removed Time Accuracy placeholder metric**
- **Removed Test Code from Production Build** (#205) - 56% bundle size reduction

### Refactored
- **Applied Newspaper Rule and Fixed max-lines ESLint Warnings** (#214)
  - Extracted helper modules following Clean Code Chapter 5 principles
  - All files now comply with max-lines limits

- **Complete Folder Reorganization and Dead Code Cleanup** (#222)
  - Restructured project folders for better organization
  - Removed unused code and files

- **Service Files Renamed to camelCase Convention** (#220)
  - Standardized service file naming across codebase

- **Renamed computeTimePerformanceScore to calculateTimePerformanceScore** (#215)
  - Consistent function naming convention

- **Shifted Service Tests to Contract-Testing Pattern** (#238)
  - Improved test architecture for better maintainability

- **Added JSDoc Data Contracts for Key Service Functions** (#239)
  - Better documentation and type hints

- **Comment Cleanup per Clean Code Chapter 4** (#218)
  - Removed 230+ lines of commented-out dead code
  - Applied "Don't comment bad code—rewrite it" principle

- **Cleaned Up Unnecessary Files in chrome-extension-app Root** (#219)
  - Removed leftover and redundant files

- **Removed Redundant Tests and Dead Code** (#237)
  - Cleaned up test files and unused code

### Tests Added
- **Unit Tests for Extracted Helper Modules** (#226)
  - Comprehensive test coverage for new helper files

---

## [1.0.0] - 2025-11-19

### Released
- **Chrome Web Store Release** - Initial public release
- CodeMaster - Algorithm Learning Assistant officially published

### Features at Release
- Personalized spaced repetition using Leitner system
- Pattern ladder difficulty progression
- Adaptive session creation with intelligent problem selection
- Tag mastery tracking with 4-gate mastery system
- LeetCode integration with timer and hint system
- Dashboard with analytics and progress tracking
- Dark/light theme support
- Focus area selection and learning plans
- Session history and productivity insights

### Chrome Web Store Preparation (#205)
- Created comprehensive chrome-store folder with all submission materials
- 8 high-quality screenshots (1280x800 PNG)
- Promotional tile (1400x560 PNG)
- Complete documentation: PRIVACY_POLICY.md, TERMS_OF_SERVICE.md, STORE_LISTING.md
- Configured Content Security Policy (CSP) in manifest.json
- All 512px icons present and referenced correctly

---

## Previous Changes

See git commit history for changes prior to V1.0.0 release.
