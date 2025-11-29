import { useState, useCallback } from "react";
import {
  Card,
  Text,
  Group,
  Stack,
  Badge,
  Grid,
} from "@mantine/core";
import { ErrorReportService } from "../services/ErrorReportService.js";
import { UserActionTracker } from "../services/UserActionTracker.js";
import performanceMonitor from "../utils/PerformanceMonitor.js";
import { AlertingService } from "../services/AlertingService.js";
import logger from "../utils/logger.js";

// Custom hook for dashboard state management
export const useProductionMonitoringState = () => {
  const [dashboardData, setDashboardData] = useState({
    performance: null,
    errors: null,
    userActions: null,
    alerts: null,
    system: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  return {
    dashboardData,
    setDashboardData,
    loading,
    setLoading,
    lastUpdated,
    setLastUpdated,
  };
};

// Custom hook for data loading functions
export const useDataLoaders = () => {
  const loadPerformanceData = useCallback(() => {
    try {
      const summary = performanceMonitor.getPerformanceSummary();
      const queryStats = performanceMonitor.getQueryStatsByOperation();

      return {
        summary,
        queryStats,
        health: performanceMonitor.getSystemHealth(),
      };
    } catch (error) {
      logger.error(
        "Failed to load performance data",
        { section: "monitoring_dashboard" },
        error
      );
      return null;
    }
  }, []);

  const loadErrorData = useCallback(async () => {
    try {
      const [recentErrors, errorStats] = await Promise.all([
        ErrorReportService.getErrorReports({ limit: 10 }),
        ErrorReportService.getErrorStatistics(7),
      ]);

      return {
        recentErrors,
        errorStats,
      };
    } catch (error) {
      logger.error(
        "Failed to load error data",
        { section: "monitoring_dashboard" },
        error
      );
      return null;
    }
  }, []);

  const loadUserActionData = useCallback(async () => {
    try {
      const [recentActions, actionStats] = await Promise.all([
        UserActionTracker.getRecentActions({ limit: 10 }),
        UserActionTracker.getActionStatistics(7),
      ]);

      return {
        recentActions,
        actionStats,
      };
    } catch (error) {
      logger.error(
        "Failed to load user action data",
        { section: "monitoring_dashboard" },
        error
      );
      return null;
    }
  }, []);

  const loadAlertData = useCallback(() => {
    try {
      const alerts = AlertingService.getActiveAlerts();
      return {
        active: alerts.filter((a) => a.status === "active"),
        acknowledged: alerts.filter((a) => a.status === "acknowledged"),
        resolved: alerts.filter((a) => a.status === "resolved"),
      };
    } catch (error) {
      logger.error(
        "Failed to load alert data",
        { section: "monitoring_dashboard" },
        error
      );
      return null;
    }
  }, []);

  const loadSystemData = useCallback(() => {
    try {
      return {
        memory: performance.memory || {},
        timing: performance.timing || {},
        connection: navigator.connection || {},
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(
        "Failed to load system data",
        { section: "monitoring_dashboard" },
        error
      );
      return null;
    }
  }, []);

  return {
    loadPerformanceData,
    loadErrorData,
    loadUserActionData,
    loadAlertData,
    loadSystemData,
  };
};

// Custom hook for helper functions
export const useMonitoringHelpers = () => {
  const getHealthColor = (health) => {
    const colors = {
      good: "green",
      warning: "yellow",
      critical: "red",
    };
    return colors[health] || "gray";
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return {
    getHealthColor,
    formatBytes,
    formatDuration,
  };
};

// User Analytics Tab Component
export const UserAnalyticsTab = ({ userActions, formatDuration }) => (
  <Grid>
    <Grid.Col span={12}>
      <Card withBorder>
        <Text fw={500} mb="md">
          User Behavior Analytics
        </Text>
        {userActions?.analytics && (
          <Grid>
            <Grid.Col span={6}>
              <Text size="sm" mb="xs">
                Activity Summary
              </Text>
              <Stack spacing="xs">
                <Group justify="space-between">
                  <Text size="sm">Total Actions</Text>
                  <Text size="sm" fw={500}>
                    {userActions.analytics.totalActions}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Unique Sessions</Text>
                  <Text size="sm" fw={500}>
                    {userActions.analytics.uniqueSessions}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Avg Session Time</Text>
                  <Text size="sm" fw={500}>
                    {formatDuration(userActions.analytics.averageSessionTime)}
                  </Text>
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" mb="xs">
                Top Actions
              </Text>
              <Stack spacing="xs">
                {Object.entries(userActions.analytics.topActions)
                  .slice(0, 5)
                  .map(([action, count]) => (
                    <Group key={action} justify="space-between">
                      <Text size="sm" lineClamp={1}>
                        {action}
                      </Text>
                      <Badge size="sm">{count}</Badge>
                    </Group>
                  ))}
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Card>
    </Grid.Col>
  </Grid>
);

// Alerts Tab Component
export const AlertsTab = ({ alerts, getHealthColor }) => (
  <Card withBorder>
    <Text fw={500} mb="md">
      System Alerts
    </Text>
    {alerts && (
      <Stack spacing="sm">
        {alerts.recentAlerts?.map((alert, index) => (
          <Card key={index} withBorder radius="sm" p="sm">
            <Group justify="space-between" mb="xs">
              <Text fw={500} size="sm">
                {alert.title}
              </Text>
              <Badge color={getHealthColor(alert.severity)} size="sm">
                {alert.severity}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">
              {alert.message}
            </Text>
            <Text size="xs" c="dimmed">
              {new Date(alert.timestamp).toLocaleString()}
            </Text>
          </Card>
        ))}

        {(!alerts.recentAlerts || alerts.recentAlerts.length === 0) && (
          <Text size="sm" c="dimmed" ta="center">
            No recent alerts
          </Text>
        )}
      </Stack>
    )}
  </Card>
);

// System Tab Component
export const SystemTab = ({ system, formatBytes }) => (
  <Card withBorder>
    <Text fw={500} mb="md">
      System Information
    </Text>
    {system && (
      <Stack spacing="sm">
        <Group justify="space-between">
          <Text size="sm">Log Level</Text>
          <Badge>{system.logLevel}</Badge>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Memory Limit</Text>
          <Text size="sm" fw={500}>
            {formatBytes(system.memory?.limit)}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Current URL</Text>
          <Text size="sm" fw={500} lineClamp={1}>
            {system.url}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Environment</Text>
          <Badge color={process.env.NODE_ENV === "production" ? "green" : "blue"}>
            {process.env.NODE_ENV || "development"}
          </Badge>
        </Group>
      </Stack>
    )}
  </Card>
);
