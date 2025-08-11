# Mock Services Documentation

## Overview

The mock services provide realistic test data for the dashboard UI, allowing development and testing without requiring real database data.

## Quick Start

### Enable Mock Mode

Mock mode is enabled by default in development. To manually control it:

```javascript
import {
  toggleMockMode,
  setUserScenario,
  USER_SCENARIOS,
} from "./config/mockConfig";

// Toggle mock mode on/off
toggleMockMode();

// Set user scenario for testing
setUserScenario(USER_SCENARIOS.ACTIVE_USER);
```

### User Scenarios

Four predefined user scenarios are available:

- **NEW_USER**: Minimal data, mostly empty states
- **BEGINNER_USER**: Some solved problems, early progress
- **ACTIVE_USER**: Diverse data across all metrics (default)
- **ADVANCED_USER**: High mastery levels, complex trends

## Configuration

### Feature Flags (`mockConfig.js`)

```javascript
export const FEATURE_FLAGS = {
  USE_MOCK_DATA: true, // Master flag
  MOCK_DASHBOARD_SERVICE: true, // Dashboard service mock
  SHOW_MOCK_INDICATORS: true, // Visual indicators
  LOG_MOCK_ACTIVITY: true, // Console logging
};
```

### Mock Data Configuration

```javascript
export const MOCK_CONFIG = {
  defaultUserType: USER_SCENARIOS.ACTIVE_USER,
  networkDelay: { default: 500 }, // Simulated network delay
  indicators: {
    showBadge: true, // Show "MOCK" badge
    badgeText: "🎭 MOCK",
    badgeColor: "#ff6b35",
  },
};
```

## Usage Examples

### Basic Usage

The app automatically uses mock data when `USE_MOCK_DATA` is enabled:

```javascript
// In app.jsx - automatically handled
const useMockData = shouldUseMockDashboard();
if (useMockData) {
  const mockData = await getMockDashboardStatistics();
}
```

### Advanced Usage

```javascript
import {
  mockDashboardService,
  USER_SCENARIOS,
} from "./services/mockDashboardService";

// Set user type
mockDashboardService.setUserType(USER_SCENARIOS.BEGINNER_USER);

// Get data with custom delay
mockDashboardService.setDelay(1000);
const data = await mockDashboardService.getDashboardStatistics();

// Get specific chart data
const chartData = await mockDashboardService.getChartData("accuracy");

// Simulate error conditions
try {
  await mockDashboardService.getDashboardStatisticsWithError("network");
} catch (error) {
  console.error("Simulated error:", error);
}
```

### Testing All Scenarios

```javascript
const allScenarios = await mockDashboardService.getAllUserScenarios();
console.log("All user scenarios:", allScenarios);
```

## Generated Data Structure

### Statistics Data

```javascript
{
  statistics: {
    totalSolved: 45,
    mastered: 12,
    inProgress: 28,
    new: 15
  },
  averageTime: {
    overall: 23.5,
    Easy: 15.2,
    Medium: 28.7,
    Hard: 45.1
  },
  successRate: {
    overall: 72,
    Easy: 85,
    Medium: 65,
    Hard: 40
  }
}
```

### Chart Data

```javascript
{
  accuracyData: {
    weekly: [
      { name: 'Week 1', accuracy: 65 },
      { name: 'Week 2', accuracy: 72 },
      // ...
    ],
    monthly: [...],
    yearly: [...]
  },
  activityData: {
    weekly: [
      { name: 'Week 1', attempted: 15, passed: 10, failed: 5 },
      // ...
    ]
  }
}
```

## Development Tools

### Console Commands

When mock mode is enabled, these are available in browser console:

```javascript
// Toggle mock mode
toggleMockMode();

// Change user scenario
setUserScenario("advanced");

// Get current config
getMockConfig();

// Access mock service directly
mockDashboardService.setUserType("beginner");
```

### Visual Indicators

- **Badge**: Shows "🎭 MOCK" in top-right corner when mock mode is active
- **Console Warning**: Logs mock mode status on app initialization
- **Different Data**: Mock data has consistent patterns you can recognize

## Customization

### Adding New User Scenarios

1. Add scenario to `USER_SCENARIOS` in `mockDataService.js`
2. Update data generation logic in `generateMockSessions`, `generateMockAttempts`
3. Add configuration in `MOCK_CONFIG.dataGeneration`

### Custom Mock Data

```javascript
// Override specific values
const customMockData = generateMockData("active");
customMockData.statistics.totalSolved = 100;
```

### New Chart Types

Add chart data generation in `generateChartData()` function in `mockDataService.js`.

## Production Usage

Mock services are automatically disabled in production builds. To explicitly disable:

```javascript
FEATURE_FLAGS.USE_MOCK_DATA = false;
```

## Troubleshooting

### Mock Data Not Loading

- Check console for "🎭 Using mock dashboard data" message
- Verify `USE_MOCK_DATA` flag is enabled
- Check for JavaScript errors in mock service files

### Performance Issues

- Reduce `networkDelay` in config
- Set `MOCK_NETWORK_DELAY: false` for instant responses
- Use fewer sessions in user scenarios

### Data Inconsistencies

- Mock data is generated fresh each time
- Use fixed seeds for consistent data in tests
- Check that all related data (sessions, attempts, problems) align

## API Reference

See individual service files for detailed API documentation:

- `mockDataService.js` - Core data generation
- `mockDashboardService.js` - Dashboard service wrapper
- `mockConfig.js` - Configuration management
