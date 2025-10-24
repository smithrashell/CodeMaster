# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL RULES - READ FIRST ⚠️

### **NEVER REVERT CODE WITHOUT EXPLICIT USER PERMISSION**

**NEVER** run any of these commands without the user explicitly asking:
- `git reset`
- `git reset --hard`
- `git checkout -- <file>`
- `git checkout <commit> -- <file>`
- `git revert`
- `git stash drop`
- Any other command that discards or reverts code changes

**IF YOU NEED TO TEST SOMETHING:**
- Create a new branch
- Use `git stash` (but never `git stash drop`)
- Ask the user first

**LOSING USER'S WORK IS UNACCEPTABLE** - Always commit work before exploring alternatives.

## Development Commands

- **Build for production**: `npm run build`
- **Development build with watch**: `npm run dev`
- **Linting**: `npm run lint`
- **Auto-fix linting issues**: `npm run lint:fix`
- **Format code**: `npm run format`
- **Run tests**: `npm test`
- **Run tests in watch mode**: `npm run test:watch`
- **Run tests with coverage**: `npm run test:coverage`
- **Run tests for CI**: `npm run test:ci`

## Project Architecture

### Chrome Extension Structure

This is a Chrome extension with multiple entry points:
- **popup**: Extension popup interface (`src/popup/`)
- **content**: Content script for LeetCode integration (`src/content/`)
- **background**: Service worker (`public/background.js`)
- **app**: Standalone dashboard application (`src/app/`)

### Core Architecture Components

**Database Layer** (`src/shared/db/`):
- Uses IndexedDB with version 22 for local storage
- Key stores: `problems`, `sessions`, `attempts`, `tag_mastery`, `standard_problems`, `pattern_ladders`
- Central database helper in `index.js` manages schema and connections

**Service Layer** (`src/shared/services/`):
- `ProblemService`: Problem fetching, session creation, adaptive algorithms
- `SessionService`: Session lifecycle management and completion tracking
- `AttemptsService`: Problem attempt tracking and statistics
- `TagService`: Tag mastery and learning state management
- `ScheduleService`: Spaced repetition scheduling logic

**Dashboard Service Layer** (`src/app/services/`):
- `dashboardService`: Aggregates data from multiple sources for dashboard analytics
- `mockDashboardService`: Development mock service for UI testing
- All dashboard data access goes through background script Chrome messaging

**Key Business Logic**:
- **Leitner System**: Spaced repetition using box levels and cooldown periods
- **Pattern Ladders**: Tag-aware difficulty progression system
- **Adaptive Sessions**: Dynamic session length and content based on performance
- **Tag Mastery Engine**: Tracks ladder completion and decay scores

### Data Flow

1. Problems are fetched from LeetCode via content scripts
2. Session problems are selected using adaptive algorithms
3. Attempts are tracked and analyzed for performance metrics
4. Tag mastery is calculated based on success rates and patterns
5. Future sessions are adapted based on historical performance

### UI Architecture

**Shared Components** (`src/shared/components/`):
- Uses Mantine UI library for consistent styling
- Theme support with dark/light mode toggle
- Recharts for analytics visualization
- Modular CSS with CSS modules for component styling

**Route Structure**:
- Dashboard with progress and statistics views
- Problem generator and session management
- Settings with adaptive session controls
- Analytics with detailed performance breakdowns

### Extension Integration

**Content Script**: Overlays on LeetCode pages to capture problem data and provide timer functionality
**Background Script**: Handles inter-tab communication and data persistence
**Popup**: Quick access interface for basic extension controls

## Dashboard Architecture

### Dashboard Data Contract

The dashboard uses a unified data service that returns a flattened structure for component compatibility:

```javascript
{
  // Flattened properties for direct component access
  statistics: { totalSolved, mastered, inProgress, new },
  averageTime: { overall, Easy, Medium, Hard },
  successRate: { overall, Easy, Medium, Hard },
  allSessions: [...],
  
  // Structured data sections
  sessions: { allSessions, sessionAnalytics, productivityMetrics },
  mastery: { currentTier, masteredTags, focusTags, masteryData },
  goals: { learningPlan: { cadence, focus, guardrails, missions } }
}
```

### Background Script Endpoints

Dashboard pages communicate with the background script via Chrome messaging:

- `getStatsData`: Overview page statistics and metrics
- `getLearningProgressData`: Progress tracking and box level data  
- `getGoalsData`: Learning plan configuration and missions
- `getSessionHistoryData`: Session history and analytics
- `getProductivityInsightsData`: Productivity metrics and insights
- `getTagMasteryData`: Tag mastery progression and focus areas
- `getLearningPathData`: Learning path visualization data
- `getMistakeAnalysisData`: Error analysis and recommendations

### Dashboard Pages

**usePageData Hook**: All dashboard pages use this hook for data fetching:
```javascript
const { data, loading, error, refresh } = usePageData('page-type');
```

**Mock vs Real Data**: Controlled by `.env` file setting `USE_MOCK_SERVICE=false`

### Error Handling

- Chrome messaging failures are handled gracefully with error states
- Loading states prevent UI flashing during data fetch
- Retry functionality available on all pages
- Fallback to empty states when no data available

### Testing Strategy

- **Unit Tests**: `src/app/services/__tests__/` - Test service functions in isolation
- **Integration Tests**: `src/app/__tests__/integration/` - Test page data flow
- **Mock Data**: Development mock service for UI testing without database

### Troubleshooting Dashboard Issues

1. **No Data Showing**: Check `.env` file - set `USE_MOCK_SERVICE=true` for development
2. **Chrome Messaging Errors**: Verify background script is loaded and handlers are registered
3. **Performance Issues**: Check console for timing logs and database query performance
4. **Mock Data Issues**: Use browser console: `enableMockMode()` and reload

## Performance Guidelines

### Import Strategy
- **NEVER use dynamic imports** (`await import()`) in performance-critical paths
- Dynamic imports add 2-3ms overhead per call and should be avoided in:
  - Background script message handlers
  - Hint interaction systems
  - Real-time UI operations
- **Use static imports** at the top of files for all production code
- Reserve dynamic imports only for code-splitting large components that aren't performance-critical

### Chrome Extension Performance
- **Cache module references** in background script on startup
- **Avoid repeated IndexedDB queries** - cache frequently accessed data
- **Minimize Chrome messaging round trips** - batch operations when possible
- **Remove verbose console.log statements** in production code
- Keep hint interactions and UI operations under 5ms target

### Database Operations
- **Batch IndexedDB operations** when possible
- **Cache problem/session context** rather than querying per interaction
- **Use efficient IndexedDB indexes** for frequent queries
- **Avoid blocking the main thread** with large database operations

## Database Access Rules

**CRITICAL**: All UI component database access MUST go through the background script using Chrome messaging. Services may access the database directly for business logic operations.

### Database Access Policy

#### ✅ ALLOWED Direct Database Access:
- **Services**: `src/shared/services/` and `src/app/services/` (business logic layer)
- **Background Script**: `public/background.js` (Chrome messaging handlers)
- **Test Files**: Direct access for test setup and assertions
- **Migration/Utility Scripts**: Backup, restore, and maintenance operations

#### ❌ PROHIBITED Direct Database Access:
- **All UI Components**: Content scripts, dashboard pages, popup components
- **All React Components**: Must use Chrome messaging instead

### Required Architecture Flow
```
UI Components/Pages → useChromeMessage/ChromeAPIErrorHandler → Background Script → Services → Database
                                                                    ↑
                                                                Services can access DB directly
```

### How to Add New Database Operations
1. Create function in `src/app/services/dashboardService.js` and export it
2. Import the function in `public/background.js`  
3. Add message handler case: `case "newOperation": newFunction(request.options).then().catch().finally()`
4. UI calls via: `ChromeAPIErrorHandler.sendMessageWithRetry({ type: 'newOperation' })`

### Examples of Correct Usage
```javascript
// ✅ CORRECT - Dashboard page
const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
  type: 'getHintAnalyticsData',
  filters: { startDate, endDate }
});

// ❌ INCORRECT - Dashboard page  
const analytics = await HintInteractionService.getSystemAnalytics(); // NEVER DO THIS
```

This architecture ensures:
- Consistent error handling and retry logic
- Proper Chrome extension security model
- Centralized database access control
- Better performance through background script caching

### ESLint Enforcement

The codebase uses ESLint rules to enforce this architecture:

#### Database Access Restrictions:
- UI components are prevented from importing database or service modules directly
- ESLint errors will occur if components try to bypass Chrome messaging
- Services are allowed direct database access as they are the business logic layer

#### Chrome Extension Compatibility:
- **No Dynamic Imports**: Dynamic imports (`await import()`) are prohibited as they don't work reliably in Chrome extensions
- **Static Imports Only**: All imports must be at the top of files using static import syntax
- **Context-Aware Function Limits**: Different complexity limits for different file types:
  - Components/Pages: 130 lines max
  - Services: 130 lines max, complexity 30
  - Database operations: 150 lines max
  - Algorithm files: 150 lines max, complexity 35

## Development Notes

- Uses Webpack for bundling with separate dev/prod configurations
- React 18 with functional components and hooks
- IndexedDB for persistent local storage without backend dependency
- Chrome extension manifest v3 architecture
- ESLint and Prettier for code quality

## Theming Guidelines

### Dark Mode Badge Text Color Fix

When badges appear with poor contrast in dark mode, use Mantine's official approaches instead of direct CSS overrides:

#### ✅ PREFERRED: Mantine Styles API
```javascript
// In theme configuration
Badge: {
  styles: (theme) => {
    const isDarkMode = document.body?.getAttribute('data-theme') === 'dark';
    return {
      root: isDarkMode ? {
        color: '#ffffff !important',
        '&:hover': {
          color: '#ffffff !important',
        }
      } : {}
    };
  }
}
```

#### ✅ PREFERRED: Variant Color Resolver
```javascript
const variantColorResolver = (input) => {
  const isDarkMode = document.body?.getAttribute('data-theme') === 'dark';
  
  if (isDarkMode && input.variant === 'light') {
    const result = defaultVariantColorsResolver(input);
    return {
      ...result,
      color: '#ffffff',
      hoverColor: '#ffffff',
    };
  }
  
  return defaultVariantColorsResolver(input);
};
```

#### ❌ AVOID: Direct CSS Overrides
- Do not add CSS rules like `[data-theme="dark"] .mantine-Badge-root { color: #ffffff !important; }`
- Direct overrides bypass Mantine's design system and can cause maintenance issues
- Use Mantine's official theming APIs for better integration and maintainability

#### ❌ PROHIBITED: SegmentedControl CSS Overrides
Never add direct CSS overrides for SegmentedControl components like:
```css
/* Fix SegmentedControl in dark mode */
body[data-theme="dark"] .mantine-SegmentedControl-root {
  background-color: #1f2a38;
}

body[data-theme="dark"] .mantine-SegmentedControl-label {
  color: #ffffff !important;
}

body[data-theme="dark"] .mantine-SegmentedControl-control[data-active] {
  background-color: #1e3a8a !important;
}

body[data-theme="dark"] .mantine-SegmentedControl-control[data-active] .mantine-SegmentedControl-label {
  color: #ffffff !important;
}
```
- These overrides break Mantine's component architecture
- Use component styles in the theme provider instead