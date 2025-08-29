import  { useState, useEffect } from "react";
import {
  Card,
  Text,
  Group,
  Stack,
  Badge,
  Grid,
  Progress,
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
import { ErrorReportService } from "../services/ErrorReportService.js";
import { UserActionTracker } from "../services/UserActionTracker.js";
import performanceMonitor from "../utils/PerformanceMonitor.js";
import { AlertingService } from "../services/AlertingService.js";
import logger from "../utils/logger.js";

/**
 * Production Monitoring Dashboard
 * Comprehensive view of system health, errors, performance, and user analytics
 */
export function ProductionMonitoringDashboard() {
  const [dashboardData, setDashboardData] = useState({
    performance: null,
    errors: null,
    userActions: null,
    alerts: null,
    system: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load dashboard data
  const loadDashboardData = async () => {
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
  };

  // Load performance data
  const loadPerformanceData = async () => {
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

  // Load error data
  const loadErrorData = async () => {
    try {
      const [recentErrors, errorStats] = await Promise.all([
        ErrorReportService.getErrorReports({ limit: 10 }),
        ErrorReportService.getErrorStatistics(7), // Last 7 days
      ]);

      return {
        recentErrors,
        statistics: errorStats,
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

  // Load user action data
  const loadUserActionData = async () => {
    try {
      const [recentActions, analytics] = await Promise.all([
        UserActionTracker.getUserActions({ limit: 20 }),
        UserActionTracker.getUserAnalytics(7), // Last 7 days
      ]);

      return {
        recentActions,
        analytics,
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

  // Load alert data
  const loadAlertData = () => {
    try {
      return AlertingService.getAlertStatistics();
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

  // Load system data
  const loadSystemData = () => {
    try {
      const memInfo = performance.memory
        ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
          }
        : null;

      return {
        memory: memInfo,
        userAgent: navigator.userAgent,
        url: window.location.href,
        logLevel: logger.getLogLevel(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return null;
    }
  };

  // Get health color based on status
  const getHealthColor = (health) => {
    const colors = {
      good: "green",
      warning: "yellow",
      critical: "red",
    };
    return colors[health] || "gray";
  };

  // Format memory usage
  const formatBytes = (bytes) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboardData.system) {
    return (
      <Card withBorder>
        <Text>Loading monitoring dashboard...</Text>
      </Card>
    );
  }

  return (
    <Stack spacing="md">
      {/* Header */}
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

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconActivity size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab
            value="performance"
            leftSection={<IconChartLine size={16} />}
          >
            Performance
          </Tabs.Tab>
          <Tabs.Tab value="errors" leftSection={<IconBug size={16} />}>
            Errors
          </Tabs.Tab>
          <Tabs.Tab value="users" leftSection={<IconUser size={16} />}>
            User Analytics
          </Tabs.Tab>
          <Tabs.Tab
            value="alerts"
            leftSection={<IconAlertTriangle size={16} />}
          >
            Alerts
          </Tabs.Tab>
          <Tabs.Tab value="system" leftSection={<IconServer size={16} />}>
            System
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Grid>
            <Grid.Col span={6}>
              <Card withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>System Health</Text>
                  <Badge
                    color={getHealthColor(dashboardData.performance?.health)}
                  >
                    {dashboardData.performance?.health || "unknown"}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="md">
                  Overall system status and performance indicators
                </Text>

                {dashboardData.performance?.summary && (
                  <Stack spacing="xs">
                    <Group justify="space-between">
                      <Text size="sm">Uptime</Text>
                      <Text size="sm" fw={500}>
                        {formatDuration(
                          dashboardData.performance.summary.uptime
                        )}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Queries</Text>
                      <Text size="sm" fw={500}>
                        {
                          dashboardData.performance.summary.systemMetrics
                            .totalQueries
                        }
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Error Rate</Text>
                      <Text size="sm" fw={500}>
                        {dashboardData.performance.summary.systemMetrics.errorRate.toFixed(
                          2
                        )}
                        %
                      </Text>
                    </Group>
                  </Stack>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={6}>
              <Card withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>Recent Activity</Text>
                  <Badge>
                    {dashboardData.errors?.recentErrors?.length || 0} errors
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="md">
                  Latest errors and user actions
                </Text>

                {dashboardData.errors?.recentErrors && (
                  <Stack spacing="xs">
                    {dashboardData.errors.recentErrors
                      .slice(0, 3)
                      .map((error, index) => (
                        <Group key={index} justify="space-between">
                          <Text size="sm" lineClamp={1}>
                            {error.message}
                          </Text>
                          <Badge
                            size="sm"
                            color={error.severity === "high" ? "red" : "yellow"}
                          >
                            {error.severity}
                          </Badge>
                        </Group>
                      ))}
                  </Stack>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={12}>
              <Card withBorder>
                <Text fw={500} mb="md">
                  Quick Stats
                </Text>
                <Grid>
                  <Grid.Col span={3}>
                    <Stack align="center" spacing="xs">
                      <Text size="xl" fw={700} c="blue">
                        {dashboardData.userActions?.analytics?.totalActions ||
                          0}
                      </Text>
                      <Text size="sm" c="dimmed">
                        User Actions
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Stack align="center" spacing="xs">
                      <Text size="xl" fw={700} c="red">
                        {dashboardData.errors?.statistics?.totalErrors || 0}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Total Errors
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Stack align="center" spacing="xs">
                      <Text size="xl" fw={700} c="orange">
                        {dashboardData.alerts?.total24h || 0}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Alerts (24h)
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Stack align="center" spacing="xs">
                      <Text size="xl" fw={700} c="green">
                        {dashboardData.performance?.summary?.systemMetrics.averageQueryTime?.toFixed(
                          0
                        ) || 0}
                        ms
                      </Text>
                      <Text size="sm" c="dimmed">
                        Avg Response
                      </Text>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Performance Tab */}
        <Tabs.Panel value="performance">
          <Grid>
            <Grid.Col span={12}>
              <Card withBorder>
                <Text fw={500} mb="md">
                  Performance Metrics
                </Text>
                {dashboardData.performance?.summary && (
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm" mb="xs">
                        Query Performance
                      </Text>
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" c="dimmed">
                          Average Query Time
                        </Text>
                        <Text size="xs" fw={500}>
                          {dashboardData.performance.summary.systemMetrics.averageQueryTime.toFixed(
                            2
                          )}
                          ms
                        </Text>
                      </Group>
                      <Progress
                        value={Math.min(
                          dashboardData.performance.summary.systemMetrics
                            .averageQueryTime / 20,
                          100
                        )}
                        color={
                          dashboardData.performance.summary.systemMetrics
                            .averageQueryTime > 1000
                            ? "red"
                            : "blue"
                        }
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" mb="xs">
                        Memory Usage
                      </Text>
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" c="dimmed">
                          Current Usage
                        </Text>
                        <Text size="xs" fw={500}>
                          {formatBytes(dashboardData.system?.memory?.used)}
                        </Text>
                      </Group>
                      <Progress
                        value={
                          dashboardData.system?.memory
                            ? (dashboardData.system.memory.used /
                                dashboardData.system.memory.limit) *
                              100
                            : 0
                        }
                        color={
                          dashboardData.system?.memory &&
                          dashboardData.system.memory.used /
                            dashboardData.system.memory.limit >
                            0.8
                            ? "red"
                            : "blue"
                        }
                      />
                    </Grid.Col>
                  </Grid>
                )}
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Errors Tab */}
        <Tabs.Panel value="errors">
          <Card withBorder>
            <Text fw={500} mb="md">
              Error Reports
            </Text>
            {dashboardData.errors?.recentErrors && (
              <Stack spacing="sm">
                {dashboardData.errors.recentErrors.map((error) => (
                  <Card key={error.id} withBorder radius="sm" p="sm">
                    <Group justify="space-between" mb="xs">
                      <Text fw={500} size="sm" lineClamp={1}>
                        {error.message}
                      </Text>
                      <Badge
                        color={error.severity === "high" ? "red" : "yellow"}
                        size="sm"
                      >
                        {error.severity}
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        {error.section}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(error.timestamp).toLocaleString()}
                      </Text>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* User Analytics Tab */}
        <Tabs.Panel value="users">
          <Grid>
            <Grid.Col span={12}>
              <Card withBorder>
                <Text fw={500} mb="md">
                  User Behavior Analytics
                </Text>
                {dashboardData.userActions?.analytics && (
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm" mb="xs">
                        Activity Summary
                      </Text>
                      <Stack spacing="xs">
                        <Group justify="space-between">
                          <Text size="sm">Total Actions</Text>
                          <Text size="sm" fw={500}>
                            {dashboardData.userActions.analytics.totalActions}
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Unique Sessions</Text>
                          <Text size="sm" fw={500}>
                            {dashboardData.userActions.analytics.uniqueSessions}
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Avg Session Time</Text>
                          <Text size="sm" fw={500}>
                            {formatDuration(
                              dashboardData.userActions.analytics
                                .averageSessionTime
                            )}
                          </Text>
                        </Group>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" mb="xs">
                        Top Actions
                      </Text>
                      <Stack spacing="xs">
                        {Object.entries(
                          dashboardData.userActions.analytics.topActions
                        )
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
        </Tabs.Panel>

        {/* Alerts Tab */}
        <Tabs.Panel value="alerts">
          <Card withBorder>
            <Text fw={500} mb="md">
              System Alerts
            </Text>
            {dashboardData.alerts && (
              <Stack spacing="sm">
                {dashboardData.alerts.recentAlerts?.map((alert, index) => (
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

                {(!dashboardData.alerts.recentAlerts ||
                  dashboardData.alerts.recentAlerts.length === 0) && (
                  <Text size="sm" c="dimmed" ta="center">
                    No recent alerts
                  </Text>
                )}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* System Tab */}
        <Tabs.Panel value="system">
          <Card withBorder>
            <Text fw={500} mb="md">
              System Information
            </Text>
            {dashboardData.system && (
              <Stack spacing="sm">
                <Group justify="space-between">
                  <Text size="sm">Log Level</Text>
                  <Badge>{dashboardData.system.logLevel}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Memory Limit</Text>
                  <Text size="sm" fw={500}>
                    {formatBytes(dashboardData.system.memory?.limit)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Current URL</Text>
                  <Text size="sm" fw={500} lineClamp={1}>
                    {dashboardData.system.url}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Environment</Text>
                  <Badge
                    color={
                      process.env.NODE_ENV === "production" ? "green" : "blue"
                    }
                  >
                    {process.env.NODE_ENV || "development"}
                  </Badge>
                </Group>
              </Stack>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

export default ProductionMonitoringDashboard;
