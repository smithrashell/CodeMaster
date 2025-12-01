# 📁 Project Structure

Complete directory structure and organization of the CodeMaster codebase.

**Last Updated:** 2025-12-01

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
├── node_modules/                # Dependencies (gitignored)
├── package.json                 # Dependencies and scripts
├── webpack.config.js            # Development build config
├── webpack.production.js        # Production build config
├── jest.config.js               # Jest test configuration
├── .eslintrc.json               # ESLint configuration
├── README.md                    # Technical architecture
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

**NOTE:** As of Issue #222, the shared folder has been reorganized into domain-driven subfolders.

```
src/shared/
├── components/                  # Reusable React components
│   ├── error/                   # Error handling components
│   │   └── ErrorBoundary.jsx
│   ├── monitoring/              # Data integrity monitoring
│   │   ├── DataIntegrityDashboard.jsx
│   │   ├── ErrorsTab.jsx
│   │   ├── OverviewTab.jsx
│   │   └── PerformanceTab.jsx
│   ├── timer/                   # Timer components
│   ├── onboarding/              # Onboarding components
│   ├── storage/                 # Storage status components
│   ├── ui/                      # Generic UI primitives
│   ├── RetryIndicator/          # Retry UI component
│   └── css/                     # Component styles
├── services/                    # Business logic layer (domain-organized)
│   ├── problem/                 # Problem management
│   │   ├── problemService.js
│   │   ├── problemNormalizer.js
│   │   └── problemRelationshipService.js
│   ├── schedule/                # Scheduling & spaced repetition
│   │   ├── scheduleService.js
│   │   └── recalibrationService.js
│   ├── session/                 # Session management
│   │   ├── sessionService.js
│   │   └── interviewService.js
│   ├── hints/                   # Hint system
│   │   ├── hintInteractionService.js
│   │   └── StrategyCacheService.js
│   ├── attempts/                # Attempt tracking
│   │   ├── attemptsService.js
│   │   ├── tagServices.js
│   │   └── adaptiveLimitsService.js
│   ├── monitoring/              # System monitoring
│   │   ├── AlertingService.js
│   │   ├── ErrorReportService.js
│   │   └── RetryDiagnostics.js
│   ├── storage/                 # Storage management
│   │   ├── storageService.js
│   │   ├── IndexedDBRetryService.js
│   │   └── StorageMigrationService.js
│   ├── chrome/                  # Chrome API wrappers
│   │   ├── ChromeAPIErrorHandler.js
│   │   └── navigationService.js
│   ├── focus/                   # Focus area coordination
│   │   ├── focusCoordinationService.js
│   │   └── onboardingService.js
│   ├── dataIntegrity/           # Data integrity checks
│   │   └── integrityCheckHelpers.js
│   └── __tests__/               # Service tests
├── db/                          # IndexedDB layer (domain-organized)
│   ├── index.js                 # Main dbHelper export with proxy
│   ├── core/                    # Database infrastructure
│   │   ├── dbHelperFactory.js   # Database helper factory
│   │   ├── dbHelperMethods.js   # CRUD operations
│   │   ├── dbHelperAdvanced.js  # Advanced operations
│   │   ├── connectionUtils.js   # Connection management
│   │   ├── storeCreation.js     # Schema definitions
│   │   └── common.js            # Common DB operations
│   ├── stores/                  # Store-specific operations
│   │   ├── problems.js
│   │   ├── sessions.js
│   │   ├── attempts.js
│   │   ├── tag_mastery.js
│   │   ├── standard_problems.js
│   │   ├── strategy_data.js
│   │   └── ... (13 stores total)
│   ├── migrations/              # Migration utilities
│   │   ├── backupDB.js
│   │   ├── restoreDB.js
│   │   └── migrationOrchestrator.js
│   ├── README.md
│   └── __tests__/
├── hooks/                       # Custom React hooks
│   ├── useChromeMessage.jsx
│   ├── useStrategy.js
│   └── useThemeColors.js
├── utils/                       # Helper functions (domain-organized)
│   ├── logging/                 # Logging utilities
│   │   ├── logger.js
│   │   └── errorNotifications.js
│   ├── leitner/                 # Leitner algorithm utilities
│   │   ├── leitnerSystem.js
│   │   └── adaptiveThresholds.js
│   ├── storage/                 # Storage utilities
│   │   ├── storageCleanup.js
│   │   └── storageHealth.js
│   ├── performance/             # Performance monitoring
│   │   └── RetryPerformanceMonitor.js
│   ├── timing/                  # Timer utilities
│   │   ├── AccurateTimer.js
│   │   └── timeMigration.js
│   ├── session/                 # Session utilities
│   │   └── sessionBalancing.js
│   ├── dataIntegrity/           # Data validation
│   │   └── DataIntegritySchemas.js
│   └── ui/                      # UI utilities
│       └── cn.js
├── constants/                   # Constants & configuration
│   ├── LeetCode_Tags_Combined.json
│   └── strategy_data.json
├── provider/                    # React context providers
├── theme/                       # Theme configuration
└── assets/                      # Static assets
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

### Services Organization (Domain-Driven)

**Services are now organized by domain** (in `/shared/services/`):

| Domain | Services | Purpose |
|--------|----------|---------|
| `problem/` | ProblemService, ProblemNormalizer | Problem selection & normalization |
| `schedule/` | ScheduleService, RecalibrationService | FSRS scheduling & recalibration |
| `session/` | SessionService, InterviewService | Session lifecycle management |
| `hints/` | HintInteractionService, StrategyCacheService | Hint system & caching |
| `attempts/` | AttemptsService, TagServices, AdaptiveLimitsService | Attempt tracking & limits |
| `monitoring/` | AlertingService, ErrorReportService, RetryDiagnostics | System monitoring |
| `storage/` | StorageService, IndexedDBRetryService, StorageMigrationService | Storage management |
| `chrome/` | ChromeAPIErrorHandler, NavigationService | Chrome API wrappers |
| `focus/` | FocusCoordinationService, OnboardingService | Focus area & onboarding |
| `dataIntegrity/` | IntegrityCheckHelpers, ReferentialIntegrityService | Data validation |

### Database Organization (Domain-Driven)

**Database layer is now organized by function** (in `/shared/db/`):

| Directory | Contents | Purpose |
|-----------|----------|---------|
| `core/` | dbHelperFactory, dbHelperMethods, dbHelperAdvanced, connectionUtils, storeCreation, common | Database infrastructure & CRUD |
| `stores/` | problems, sessions, attempts, tag_mastery, standard_problems, strategy_data, etc. | Store-specific operations (13 stores) |
| `migrations/` | backupDB, restoreDB, migrationOrchestrator | Backup, restore & schema migrations |

**13 IndexedDB Stores:**
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
11. `strategy_data` - Strategy content data
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
└── test/                        # Test setup & utilities
    └── setup.js                 # Jest configuration
```

**Test Types:**
- **Unit Tests:** Co-located with source files (`__tests__/` directories)
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

**New in 2025-12 (Issue #222 - Folder Reorganization):**
- **Services reorganized** into domain subfolders: `problem/`, `schedule/`, `session/`, `hints/`, `attempts/`, `monitoring/`, `storage/`, `chrome/`, `focus/`, `dataIntegrity/`
- **Database layer reorganized** into `core/`, `stores/`, `migrations/`
- **Utils reorganized** into `logging/`, `leitner/`, `storage/`, `performance/`, `timing/`, `session/`, `dataIntegrity/`, `ui/`
- **Components reorganized** into `error/`, `monitoring/`, `timer/`, `onboarding/`, `storage/`
- **Dead code cleanup**: 79+ orphaned files removed (~20,000 lines)
- **ESLint config updated** for new folder structure

**New in 2025-10:**
- Background handlers extracted into modules (`src/background/handlers/`)
- Onboarding system components (`src/content/components/onboarding/`)
- Data integrity monitoring (`src/shared/components/monitoring/`)
- Enhanced hint system with analytics
- Learning path visualization component

**Directory Restructuring:**
- `Frontend/` → `chrome-extension-app/` (PR #143)
- Temporary documentation archived to `docs/archive/`
- GitHub workflow templates added to `.github/`

---

## 📖 Related Documentation

- [Architecture Overview](overview.md) - System design
- [Services API](../api/services-api.md) - Service layer documentation
- [Database API](../api/database-api.md) - Database schema
- [Contributing Guide](../../CONTRIBUTING.md) - Development workflow

---

**Last Updated:** 2025-12-01
**Maintained By:** CodeMaster Team
