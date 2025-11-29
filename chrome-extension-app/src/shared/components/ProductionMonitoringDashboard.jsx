import { useEffect, useCallback } from "react";
import {
  Card,
  Text,
  Group,
  Stack,
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
import logger from "../utils/logger.js";
import { OverviewTab } from './monitoring/OverviewTab.jsx';
import { PerformanceTab } from './monitoring/PerformanceTab.jsx';
import { ErrorsTab } from './monitoring/ErrorsTab.jsx';
import {
  useProductionMonitoringState,
  useDataLoaders,
  useMonitoringHelpers,
  UserAnalyticsTab,
  AlertsTab,
  SystemTab,
} from './ProductionMonitoringHelpers.jsx';

// Dashboard Header Component
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

// Tabs Navigation Component
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

// Tab panels component
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
        { section: "monitoring_dashboard" },
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
