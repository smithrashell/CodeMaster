# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Development Notes

- Uses Webpack for bundling with separate dev/prod configurations
- React 18 with functional components and hooks
- IndexedDB for persistent local storage without backend dependency
- Chrome extension manifest v3 architecture
- ESLint and Prettier for code quality