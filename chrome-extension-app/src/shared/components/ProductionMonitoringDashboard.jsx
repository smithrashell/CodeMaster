import  { useState, useEffect, useCallback } from "react";

// Custom hook for dashboard state management
const useProductionMonitoringState = () => {
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
const useDataLoaders = () => {
  const loadPerformanceData = () => {
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
        {
          section: "monitoring_dashboard",
        },
        error
      );
      return null;
    }
  };

  const loadErrorData = async () => {
    try {
      const [recentErrors, errorStats] = await Promise.all([
        ErrorReportService.getErrorReports({ limit: 10 }),
        ErrorReportService.getErrorStatistics(7), // Last 7 days
      ]);

      return {
        recentErrors,
        errorStats,
      };
    } catch (error) {
      logger.error(
        "Failed to load error data",
        {
          section: "monitoring_dashboard",
        },
        error
      );
      return null;
    }
  };

  const loadUserActionData = async () => {
    try {
      const [recentActions, actionStats] = await Promise.all([
        UserActionTracker.getRecentActions({ limit: 10 }),
        UserActionTracker.getActionStatistics(7), // Last 7 days
      ]);

      return {
        recentActions,
        actionStats,
      };
    } catch (error) {
      logger.error(
        "Failed to load user action data",
        {
          section: "monitoring_dashboard",
        },
        error
      );
      return null;
    }
  };

  const loadAlertData = () => {
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
        {
          section: "monitoring_dashboard",
        },
        error
      );
      return null;
    }
  };

  const loadSystemData = () => {
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
        {
          section: "monitoring_dashboard",
        },
        error
      );
      return null;
    }
  };

  return {
    loadPerformanceData,
    loadErrorData,
    loadUserActionData,
    loadAlertData,
    loadSystemData,
  };
};

// Custom hook for helper functions
const useMonitoringHelpers = () => {
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
import {
  Card,
  Text,
  Group,
  Stack,
  Badge,
  Grid,
  Button,
  Tabs,
} from "@mantine/core";
import {
  IconActivity,
  IconAlertTriangle,
  IconBug,
  IconChartLine,
  IconUser,
  IconServer,
  IconRefresh,
} from "@tabler/icons-react";
import { ErrorReportService } from "../services/monitoring/ErrorReportService.js";
import { UserActionTracker } from "../services/UserActionTracker.js";
import performanceMonitor from "../utils/performance/PerformanceMonitor.js";
import { AlertingService } from "../services/monitoring/AlertingService.js";
import logger from "../utils/logging/logger.js";
import { OverviewTab } from './monitoring/OverviewTab.jsx';
import { PerformanceTab } from './monitoring/PerformanceTab.jsx';
import { ErrorsTab } from './monitoring/ErrorsTab.jsx';

/**
 * User Analytics Tab Component
 */
const UserAnalyticsTab = ({ userActions, formatDuration }) => (
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

/**
 * Alerts Tab Component
 */
const AlertsTab = ({ alerts, getHealthColor }) => (
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

/**
 * System Tab Component
 */
const SystemTab = ({ system, formatBytes }) => (
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

/**
 * Dashboard Header Component
 */
const DashboardHeader = ({ lastUpdated, loadDashboardData, loading }) => (
  <Group justify="space-between">
    <Text size="xl" fw={600}>
      Production Monitoring Dashboard
    </Text>
    <Group>
      {lastUpdated && (
        <Text size="sm" c="dimmed">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </Text>
      )}
      <Button
        leftSection={<IconRefresh size={16} />}
        variant="light"
        size="sm"
        onClick={loadDashboardData}
        loading={loading}
      >
        Refresh
      </Button>
    </Group>
  </Group>
);

/**
 * Tabs Navigation Component
 */
const TabsNavigation = () => (
  <Tabs.List>
    <Tabs.Tab value="overview" leftSection={<IconActivity size={16} />}>
      Overview
    </Tabs.Tab>
    <Tabs.Tab value="performance" leftSection={<IconChartLine size={16} />}>
      Performance
    </Tabs.Tab>
    <Tabs.Tab value="errors" leftSection={<IconBug size={16} />}>
      Errors
    </Tabs.Tab>
    <Tabs.Tab value="users" leftSection={<IconUser size={16} />}>
      User Analytics
    </Tabs.Tab>
    <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={16} />}>
      Alerts
    </Tabs.Tab>
    <Tabs.Tab value="system" leftSection={<IconServer size={16} />}>
      System
    </Tabs.Tab>
  </Tabs.List>
);

/**
 * Tab panels component
 */
const TabPanels = ({ dashboardData, getHealthColor, formatBytes, formatDuration }) => (
  <>
    <Tabs.Panel value="overview">
      <OverviewTab 
        dashboardData={dashboardData} 
        getHealthColor={getHealthColor} 
        formatBytes={formatBytes} 
      />
    </Tabs.Panel>

    <Tabs.Panel value="performance">
      <PerformanceTab 
        dashboardData={dashboardData} 
        getHealthColor={getHealthColor} 
        formatDuration={formatDuration} 
      />
    </Tabs.Panel>

    <Tabs.Panel value="errors">
      <ErrorsTab dashboardData={dashboardData} />
    </Tabs.Panel>

    <Tabs.Panel value="users">
      <UserAnalyticsTab 
        userActions={dashboardData.userActions}
        formatDuration={formatDuration}
      />
    </Tabs.Panel>

    <Tabs.Panel value="alerts">
      <AlertsTab 
        alerts={dashboardData.alerts}
        getHealthColor={getHealthColor}
      />
    </Tabs.Panel>

    <Tabs.Panel value="system">
      <SystemTab 
        system={dashboardData.system}
        formatBytes={formatBytes}
      />
    </Tabs.Panel>
  </>
);

/**
 * Production Monitoring Dashboard
 * Comprehensive view of system health, errors, performance, and user analytics
 */
export function ProductionMonitoringDashboard() {
  const {
    dashboardData,
    setDashboardData,
    loading,
    setLoading,
    lastUpdated,
    setLastUpdated,
  } = useProductionMonitoringState();

  const {
    loadPerformanceData,
    loadErrorData,
    loadUserActionData,
    loadAlertData,
    loadSystemData,
  } = useDataLoaders();

  const { getHealthColor, formatBytes, formatDuration } = useMonitoringHelpers();

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [performance, errors, userActions, alerts] = await Promise.all([
        loadPerformanceData(),
        loadErrorData(),
        loadUserActionData(),
        loadAlertData(),
      ]);

      const system = loadSystemData();

      setDashboardData({
        performance,
        errors,
        userActions,
        alerts,
        system,
      });

      setLastUpdated(new Date());
    } catch (error) {
      logger.error(
        "Failed to load dashboard data",
        {
          section: "monitoring_dashboard",
        },
        error
      );
    } finally {
      setLoading(false);
    }
  }, [loadPerformanceData, loadErrorData, loadUserActionData, loadAlertData, loadSystemData, setDashboardData, setLastUpdated, setLoading]);


  useEffect(() => {
    loadDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  if (loading && !dashboardData.system) {
    return (
      <Card withBorder>
        <Text>Loading monitoring dashboard...</Text>
      </Card>
    );
  }

  return (
    <Stack spacing="md">
      <DashboardHeader 
        lastUpdated={lastUpdated}
        loadDashboardData={loadDashboardData}
        loading={loading}
      />

      <Tabs defaultValue="overview">
        <TabsNavigation />
        <TabPanels 
          dashboardData={dashboardData}
          getHealthColor={getHealthColor}
          formatBytes={formatBytes}
          formatDuration={formatDuration}
        />
      </Tabs>
    </Stack>
  );
}

export default ProductionMonitoringDashboard;
