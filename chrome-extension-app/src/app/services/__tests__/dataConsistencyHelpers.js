/**
 * Helper functions for data consistency tests
 * Extracted to reduce line count in test files
 */

// Helper functions for Database State Consistency tests
export function createMockDataWithRaceCondition() {
  let readOrder = 0;

  return () => {
    readOrder++;

    // Simulate race condition - different pages see different states
    if (readOrder % 2 === 1) {
      return {
        statistics: { totalSolved: 15, mastered: 8 },
        allSessions: [{ id: 1 }, { id: 2 }, { id: 3 }],
        timestamp: Date.now()
      };
    } else {
      return {
        statistics: { totalSolved: 12, mastered: 6 }, // Stale data
        allSessions: [{ id: 1 }, { id: 2 }], // Missing session
        timestamp: Date.now() - 30000 // 30 seconds old
      };
    }
  };
}

export function validateDataConsistency(statsData, progressData, dashboardData) {
  const statsCount = statsData.statistics?.totalSolved || 0;
  const progressCount = progressData.statistics?.totalSolved || 0;
  const dashboardCount = dashboardData.statistics?.totalSolved || 0;

  const counts = [statsCount, progressCount, dashboardCount];
  const uniqueCounts = new Set(counts);

  if (uniqueCounts.size > 1) {
    console.error("Database isolation failure detected:", {
      statsCount,
      progressCount,
      dashboardCount
    });
  }

  return { statsCount, progressCount, dashboardCount };
}

export function createCacheTestData() {
  const freshTimestamp = Date.now();
  const staleTimestamp = Date.now() - (10 * 60 * 1000); // 10 minutes old

  return {
    fresh: {
      statistics: { totalSolved: 20 },
      timestamp: freshTimestamp,
      cacheInfo: { source: "database", lastUpdated: freshTimestamp }
    },
    stale: {
      statistics: { totalSolved: 15 }, // Stale count
      timestamp: staleTimestamp,
      cacheInfo: { source: "cache", lastUpdated: staleTimestamp }
    }
  };
}

export function detectCacheStaleness(dashboardData, statsData) {
  const timestampDiff = Math.abs(dashboardData.timestamp - statsData.timestamp);
  const dataDiff = Math.abs(
    dashboardData.statistics.totalSolved - statsData.statistics.totalSolved
  );

  if (timestampDiff > 60000 && dataDiff > 0) {
    console.warn("Cache staleness detected:", {
      timestampDiff: timestampDiff / 1000 + " seconds",
      dataDifference: dataDiff,
      sources: {
        dashboard: dashboardData.cacheInfo?.source,
        stats: statsData.cacheInfo?.source
      }
    });
  }

  return { timestampDiff, dataDiff };
}
