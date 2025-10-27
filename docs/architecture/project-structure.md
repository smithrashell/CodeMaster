# 📁 Project Structure

Complete directory structure and organization of the CodeMaster codebase.

**Last Updated:** 2025-10-25

---

## 🌳 Repository Overview

```
CodeMaster/
├── chrome-extension-app/       # Chrome extension source code (Main Application)
├── docs/                        # Documentation hub
├── .github/                     # GitHub workflows and templates
├── README.md                    # Project overview
└── CONTRIBUTING.md              # Contribution guidelines
```

---

## 📦 chrome-extension-app/

The main application directory containing all source code, build configurations, and tests.

### Root Level

```
chrome-extension-app/
├── src/                         # Source code (all entry points)
├── public/                      # Static assets and manifest
├── dist/                        # Build output (gitignored)
├── test/                        # Test setup and utilities
├── browser-tests/               # Browser-based testing framework
├── node_modules/                # Dependencies (gitignored)
├── package.json                 # Dependencies and scripts
├── webpack.config.js            # Development build config
├── webpack.production.js        # Production build config
├── jest.config.js               # Jest test configuration
├── .eslintrc.js                 # ESLint configuration
├── README.md                    # Technical architecture (792 lines)
├── CHANGELOG.md                 # Version history
├── CLAUDE.md                    # Development commands
└── TESTING.md                   # Testing framework guide
```

---

## 🎯 src/ - Source Code Structure

### Entry Points (4 Total)

CodeMaster has four distinct entry points, each serving a different purpose:

```
src/
├── app/                         # Standalone dashboard application
├── background/                  # Service worker (background script)
├── content/                     # LeetCode page integration
└── popup/                       # Extension popup interface
```

---

## 🖥️ src/app/ - Dashboard Application

Standalone React application providing full dashboard experience.

```
src/app/
├── components/                  # React components organized by feature
│   ├── analytics/               # Analytics visualizations
│   │   └── AnalyticsCard.jsx
│   ├── charts/                  # Recharts wrapper components
│   │   ├── TimeGranularChartCard.js
│   │   ├── ActivityHeatmap.jsx
│   │   └── PerformanceChart.jsx
│   ├── dashboard/               # Dashboard-specific components
│   │   ├── StatsCard.jsx
│   │   └── MetricCard.jsx
│   ├── layout/                  # Layout components
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── Footer.jsx
│   ├── learning/                # Learning path visualizations
│   │   └── LearningPathVisualization.jsx  # Interactive SVG network
│   ├── onboarding/              # User onboarding components
│   │   └── OnboardingTour.jsx
│   ├── overview/                # Overview page components
│   │   └── ProgressSummary.jsx
│   ├── productivity/            # Productivity insights
│   │   └── ProductivityDashboard.jsx
│   ├── settings/                # Settings components
│   │   ├── AdaptiveSettingsCard.jsx
│   │   └── TimerSettingsCard.jsx
│   ├── shared/                  # Shared dashboard components
│   │   └── CustomMultiSelect.jsx
│   └── tables/                  # Data table components
│       └── SelectedTagDetailCard.jsx
├── hooks/                       # Dashboard-specific hooks
│   └── usePageData.js           # Page data fetching hook
├── pages/                       # Route pages
│   ├── dashboard/               # Dashboard pages
│   │   └── index.jsx
│   ├── progress/                # Progress tracking pages
│   │   ├── goals.jsx
│   │   └── learning-progress.jsx
│   ├── sessions/                # Session management pages
│   │   ├── session-history.jsx
│   │   └── productivity-insights.jsx
│   ├── settings/                # Settings pages
│   │   └── index.jsx
│   └── strategy/                # Strategy pages
│       ├── learning-path.jsx
│       └── mistake-analysis.jsx
├── routes/                      # React Router configuration
│   └── index.jsx
├── services/                    # Dashboard-specific services
│   ├── dashboardService.js      # Dashboard data aggregation
│   └── mockDashboardService.js  # Development mock service
├── config/                      # Application configuration
├── css/                         # Global styles
├── styles/                      # Additional stylesheets
└── app.jsx                      # Application entry point
```

**Purpose:** Provides comprehensive analytics, progress tracking, and configuration interface.

---

## ⚙️ src/background/ - Service Worker

Background script handling inter-tab communication and data persistence.

```
src/background/
├── handlers/                    # Extracted message handlers (NEW)
│   ├── sessionHandlers.js       # 15 session-related handlers
│   └── problemHandlers.js       # 8 problem-related handlers
└── __tests__/                   # Background script tests
    ├── messageHandlers.test.js
    └── globalExports.test.js
```

**Location:** `public/background.js` (main file)

**Purpose:**
- Chrome runtime message handling
- Cross-tab communication
- State synchronization
- Database operation coordination

**Recent Changes:** Handlers extracted into modules for better organization (23 handlers → 2 modules).

---

## 🌐 src/content/ - LeetCode Integration

Content scripts that overlay on LeetCode pages.

```
src/content/
├── components/                  # Content script UI components
│   ├── forms/                   # Form components
│   ├── navigation/              # Navigation components
│   │   └── header.jsx
│   ├── onboarding/              # Page-specific onboarding tours (NEW)
│   │   ├── ContentOnboardingTour.jsx
│   │   ├── ElementHighlighter.jsx
│   │   ├── PageSpecificTour.jsx
│   │   └── pageTourConfigs.js
│   ├── problem/                 # Problem-related UI
│   │   ├── ProblemInfoIcon.jsx
│   │   └── WhyThisProblem.jsx
│   ├── strategy/                # Strategy/hint components
│   │   ├── FloatingHintButton.jsx
│   │   └── HintPanel.jsx
│   ├── timer/                   # Timer components
│   │   └── TimerComponent.jsx
│   └── ui/                      # Generic UI components (NEW)
│       └── SimpleButton.jsx
├── features/                    # Feature modules
│   ├── navigation/              # Navigation features
│   │   └── main.jsx
│   ├── problems/                # Problem management
│   │   ├── ProblemGenerator.jsx
│   │   ├── ProblemDetail.jsx
│   │   └── ProblemSubmission.jsx
│   ├── settings/                # Settings UI
│   ├── statistics/              # Statistics display
│   └── strategy/                # Strategy features
├── hooks/                       # Content-specific hooks
├── services/                    # Content script services
├── css/                         # Content script styles
│   ├── main.css
│   ├── theme.css
│   └── probrec.css
└── content.jsx                  # Content script entry point
```

**Purpose:**
- Problem data extraction from LeetCode
- Timer functionality
- Hint system
- User onboarding tours
- Navigation overlay

---

## 🔗 src/shared/ - Shared Code

Code shared across all entry points (app, content, popup, background).

```
src/shared/
├── components/                  # Reusable React components
│   ├── monitoring/              # Data integrity monitoring (NEW)
│   │   └── DataIntegrityDashboard.jsx
│   ├── ui/                      # Generic UI components
│   │   ├── Button.jsx
│   │   └── Modal.jsx
│   ├── RetryIndicator/          # Retry UI component
│   └── css/                     # Component styles
├── services/                    # Business logic layer (17+ services)
│   ├── problemService.js        # Problem selection & sessions
│   ├── sessionService.js        # Session lifecycle management
│   ├── tagService.js            # Tag mastery tracking
│   ├── attemptsService.js       # Attempt tracking & analytics
│   ├── scheduleService.js       # FSRS spaced repetition
│   ├── strategyService.js       # Hints & strategy content
│   ├── dashboardService.js      # Dashboard data aggregation
│   ├── onboardingService.js     # Onboarding state management (NEW)
│   ├── databaseProxy.js         # Database proxy for content scripts
│   ├── dataIntegrity/           # Data integrity utilities
│   └── __tests__/               # Service tests (comprehensive)
├── db/                          # IndexedDB layer (13 stores)
│   ├── index.js                 # Database helper & initialization
│   ├── problems.js              # Problems store operations
│   ├── sessions.js              # Sessions store operations
│   ├── attempts.js              # Attempts store operations
│   ├── tag_mastery.js           # Tag mastery store
│   ├── pattern_ladders.js       # Pattern ladder tracking
│   ├── settings.js              # User settings
│   ├── focus_tags.js            # Focus tag management
│   ├── strategy_data.js         # Strategy content data
│   ├── README.md                # Database layer documentation
│   └── __tests__/               # Database tests
├── hooks/                       # Custom React hooks
│   ├── useChromeMessage.jsx     # Chrome API messaging hook
│   ├── useStrategy.js           # Strategy & hints hook
│   └── useThemeColors.js        # Theme color integration
├── utils/                       # Helper functions
│   ├── leitnerSystem.js         # Leitner box logic
│   ├── AccurateTimer.js         # High-precision timer
│   ├── tagMasteryCalculations.js # Mastery score calculations
│   ├── dataIntegrity/           # Data integrity utilities
│   └── dbUtils/                 # Database utilities
├── constants/                   # Constants & configuration
│   ├── LeetCode_Tags_Combined.json # Tag mappings
│   └── strategy_data.js         # Strategy content
├── provider/                    # React context providers
├── theme/                       # Theme configuration
├── assets/                      # Static assets
└── Icons/                       # Icon assets
```

**Purpose:**
- Centralized business logic
- Database abstraction
- Reusable UI components
- Utility functions
- Constants and configuration

---

## 🎨 src/popup/ - Extension Popup

Quick-access popup interface when clicking the extension icon.

```
src/popup/
├── components/                  # Popup components
├── popup.jsx                    # Popup entry point
└── popup.html                   # Popup HTML template
```

**Purpose:** Quick access to basic extension controls and status.

---

## 📚 Key Directory Purposes

### Components Organization

**Feature-based components** (in `/app/components/` and `/content/components/`):
- `analytics/` - Data visualization components
- `charts/` - Recharts wrappers for consistency
- `learning/` - Learning path visualizations
- `onboarding/` - User onboarding tours
- `productivity/` - Productivity insights
- `settings/` - Configuration UI

**Generic components** (in `/shared/components/`):
- `ui/` - Reusable UI primitives (buttons, modals, etc.)
- `monitoring/` - System health monitoring
- `RetryIndicator/` - Error retry UI

### Services Organization

**Core Services** (17+ services in `/shared/services/`):
1. **ProblemService** - Problem selection, adaptive algorithms
2. **SessionService** - Session lifecycle, completion, analytics
3. **TagService** - Tag mastery, learning state
4. **AttemptsService** - Attempt tracking, statistics
5. **ScheduleService** - FSRS scheduling, review planning
6. **StrategyService** - Hints, primers, educational content
7. **DashboardService** - Dashboard data aggregation
8. **OnboardingService** - User onboarding state
9. **DatabaseProxy** - Content script database access
10. **ChromeAPIErrorHandler** - Chrome API error handling
11. **IndexedDBRetryService** - Database retry logic
12. **FocusCoordinationService** - Focus area coordination
13. **HintInteractionService** - Hint usage tracking
14. **AlertingService** - Desktop notifications
15. **StorageService** - Settings management
16. **AdaptiveLimitsService** - Dynamic time limits
17. **DataIntegrityService** - Database health checks

### Database Organization

**13 IndexedDB Stores** (in `/shared/db/`):
1. `problems` - Problem metadata & scheduling
2. `sessions` - Session data & history
3. `attempts` - Problem attempt records
4. `tag_mastery` - Tag learning progress
5. `pattern_ladders` - Ladder progression tracking
6. `settings` - User preferences
7. `focus_tags` - Focus area management
8. `review` - Review schedule (FSRS)
9. `problem_relationships` - Similar problems
10. `hint_interactions` - Hint usage analytics
11. `strategy_primers` - Educational content
12. `session_problems` - Session-problem relationships
13. `standard_problems` - LeetCode problem database

---

## 🧪 Testing Structure

```
chrome-extension-app/
├── src/**/__tests__/            # Co-located unit tests
│   ├── app/__tests__/           # Dashboard tests
│   ├── background/__tests__/    # Background script tests
│   ├── content/__tests__/       # Content script tests
│   └── shared/**/__tests__/     # Shared code tests
├── test/                        # Test setup & utilities
│   └── setup.js                 # Jest configuration
└── browser-tests/               # Browser-based integration tests
    ├── README.md
    └── SIMPLE-README.md
```

**Test Types:**
- **Unit Tests:** Co-located with source files (`__tests__/` directories)
- **Integration Tests:** Browser-based tests in `browser-tests/`
- **Service Tests:** Comprehensive service layer testing
- **Hook Tests:** React hook testing with Testing Library

---

## 📄 Configuration Files

```
chrome-extension-app/
├── package.json                 # Dependencies, scripts, metadata
├── webpack.config.js            # Development build configuration
├── webpack.production.js        # Production build configuration
├── jest.config.js               # Jest test configuration
├── .eslintrc.js                 # ESLint rules & standards
├── .prettierrc                  # Code formatting rules
├── .babelrc                     # Babel transpilation config
└── .env                         # Environment variables (gitignored)
```

---

## 🚀 Build Output

```
chrome-extension-app/dist/       # Generated by webpack (gitignored)
├── manifest.json                # Chrome extension manifest
├── app.html                     # Dashboard HTML
├── app.js                       # Dashboard bundle
├── app.css                      # Dashboard styles
├── content.js                   # Content script bundle
├── background.js                # Background script bundle
├── popup.html                   # Popup HTML
├── popup.js                     # Popup bundle
├── images/                      # Extension icons
└── *.json                       # Data files
```

**Build Commands:**
- `npm run dev` - Development build with watch mode
- `npm run build` - Production build with minification

---

## 📋 Documentation Structure

```
docs/
├── README.md                    # Documentation hub (THIS IS THE START)
├── getting-started/             # Installation & setup
├── architecture/                # Technical architecture
│   ├── project-structure.md     # THIS FILE
│   ├── overview.md
│   ├── component-architecture.md
│   └── decisions/               # ADRs
├── features/                    # Feature documentation
├── guides/                      # Developer guides
├── api/                         # API references
├── troubleshooting/             # Problem solving
├── archive/                     # Historical docs
├── COMMIT_GUIDELINES.md
├── BRANCHING_GUIDELINES.md
└── GITHUB_CLI_GUIDE.md
```

---

## 🎯 Quick Reference

### Where to find...

**React Components:**
- Dashboard components: `src/app/components/`
- Content script UI: `src/content/components/`
- Shared components: `src/shared/components/`

**Business Logic:**
- All services: `src/shared/services/`
- Database operations: `src/shared/db/`
- Utilities: `src/shared/utils/`

**Styling:**
- Dashboard styles: `src/app/css/` and `src/app/styles/`
- Content script styles: `src/content/css/`
- Component styles: Co-located with components

**Tests:**
- Unit tests: `src/**/__tests__/`
- Integration tests: `browser-tests/`
- Test utilities: `test/`

**Configuration:**
- Build config: `webpack.*.js`
- Test config: `jest.config.js`
- Lint config: `.eslintrc.js`

---

## 🆕 Recent Changes

**New in 2025-10:**
- Background handlers extracted into modules (`src/background/handlers/`)
- Onboarding system components (`src/content/components/onboarding/`)
- Data integrity monitoring (`src/shared/components/monitoring/`)
- Database proxy service (`src/shared/services/databaseProxy.js`)
- Enhanced hint system with analytics
- Learning path visualization component

**Directory Restructuring:**
- `Frontend/` → `chrome-extension-app/` (PR #143)
- Temporary documentation archived to `docs/archive/`
- GitHub workflow templates added to `.github/`

---

## 📖 Related Documentation

- [Architecture Overview](overview.md) - System design
- [Component Architecture](component-architecture.md) - Component organization
- [Services API](../api/services-api.md) - Service layer documentation
- [Database API](../api/database-api.md) - Database schema
- [Contributing Guide](../../CONTRIBUTING.md) - Development workflow

---

**Last Updated:** 2025-10-25
**Maintained By:** CodeMaster Team
