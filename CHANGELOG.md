# 📓 Changelog

All notable changes to this project will be documented in this file.

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

