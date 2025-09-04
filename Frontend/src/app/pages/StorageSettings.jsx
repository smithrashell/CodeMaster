/**
 * Storage Settings Page Component
 *
 * Comprehensive storage management interface providing health monitoring,
 * cleanup tools, migration controls, and advanced storage configuration options.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Title,
  Text,
  Group,
  Button,
  Card,
  Badge,
  Progress,
  Switch,
  Select,
  NumberInput,
  Accordion,
  Table,
  Loader,
  Notification,
  Code,
  Tabs,
} from "@mantine/core";
import {
  IconRefresh,
  IconTrash,
  IconDownload,
  IconUpload,
  IconSettings,
  IconDatabase,
  IconCloudUpload,
  IconInfoCircle,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import StorageHealthMonitor from "../../shared/utils/storageHealth.js";
import StorageCleanupManager from "../../shared/utils/storageCleanup.js";
import StorageMigrationService from "../../shared/services/StorageMigrationService.js";
import StorageStatusIndicator from "../../shared/components/StorageStatusIndicator.jsx";

export const StorageSettings = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [storageHealth, setStorageHealth] = useState(null);
  const [cleanupRecommendations, setCleanupRecommendations] = useState(null);
  const [migrationHistory, setMigrationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Modal states (reserved for future use)
  // const [showCleanupModal, setShowCleanupModal] = useState(false);
  // const [showMigrationModal, setShowMigrationModal] = useState(false);
  // const [showExportModal, setShowExportModal] = useState(false);

  // Settings states
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30);
  const [fallbackMode, setFallbackMode] = useState("auto");

  useEffect(() => {
    loadStorageData();
  }, [loadStorageData]);

  const loadStorageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [health, recommendations, migrations] = await Promise.all([
        StorageHealthMonitor.assessStorageHealth(),
        StorageCleanupManager.getCleanupRecommendations(),
        StorageMigrationService.listMigrations(),
      ]);

      setStorageHealth(health);
      setCleanupRecommendations(recommendations);
      setMigrationHistory(migrations.slice(0, 10)); // Last 10 migrations
    } catch (error) {
      addNotification("error", "Failed to load storage data");
      // Development error logging (remove in production)
      if (process.env.NODE_ENV === "development") {
        console.error("Storage data load failed:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNotification = (type, message) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date(),
    };
    setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    }, 5000);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "Unknown";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 10) / 10 + " " + sizes[i];
  };

  const formatDuration = (ms) => {
    if (!ms) return "Unknown";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Overview Tab Component
  const OverviewTab = () => (
    <div>
      <Group position="apart" mb="lg">
        <Title order={3}>Storage Overview</Title>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={loadStorageData}
          loading={isLoading}
        >
          Refresh
        </Button>
      </Group>

      {/* Storage Status Indicator */}
      <Card mb="lg">
        <StorageStatusIndicator position="standalone" showDetails={false} />
      </Card>

      {/* Health Summary */}
      {storageHealth && (
        <Card mb="lg">
          <Title order={4} mb="md">
            Health Summary
          </Title>

          <Group spacing="xl" mb="lg">
            <div>
              <Text size="sm" color="dimmed">
                IndexedDB Status
              </Text>
              <Group spacing="xs">
                {storageHealth.indexedDB.available ? (
                  <IconCheck size={16} color="green" />
                ) : (
                  <IconX size={16} color="red" />
                )}
                <Badge
                  color={storageHealth.indexedDB.available ? "green" : "red"}
                  size="sm"
                >
                  {storageHealth.indexedDB.status}
                </Badge>
              </Group>
              {storageHealth.indexedDB.quota && (
                <Text size="xs" color="dimmed">
                  {formatBytes(storageHealth.indexedDB.used)} /
                  {formatBytes(storageHealth.indexedDB.quota)}
                </Text>
              )}
            </div>

            <div>
              <Text size="sm" color="dimmed">
                Chrome Storage Status
              </Text>
              <Group spacing="xs">
                {storageHealth.chromeStorage.available ? (
                  <IconCheck size={16} color="green" />
                ) : (
                  <IconX size={16} color="red" />
                )}
                <Badge
                  color={
                    storageHealth.chromeStorage.available ? "green" : "red"
                  }
                  size="sm"
                >
                  {storageHealth.chromeStorage.status}
                </Badge>
              </Group>
              <Text size="xs" color="dimmed">
                {formatBytes(storageHealth.chromeStorage.bytesInUse)} /
                {formatBytes(storageHealth.chromeStorage.quota)}
              </Text>
            </div>
          </Group>

          {/* Usage Charts */}
          {storageHealth.indexedDB.quota && (
            <div>
              <Text size="sm" mb={4}>
                IndexedDB Usage
              </Text>
              <Progress
                value={storageHealth.indexedDB.usagePercentage * 100}
                color={
                  storageHealth.indexedDB.usagePercentage > 0.9
                    ? "red"
                    : storageHealth.indexedDB.usagePercentage > 0.8
                    ? "yellow"
                    : "blue"
                }
                size="lg"
                label={`${Math.round(
                  storageHealth.indexedDB.usagePercentage * 100
                )}%`}
              />
            </div>
          )}

          {storageHealth.chromeStorage.quota && (
            <div style={{ marginTop: "16px" }}>
              <Text size="sm" mb={4}>
                Chrome Storage Usage
              </Text>
              <Progress
                value={storageHealth.chromeStorage.usagePercentage * 100}
                color={
                  storageHealth.chromeStorage.usagePercentage > 0.9
                    ? "red"
                    : storageHealth.chromeStorage.usagePercentage > 0.8
                    ? "yellow"
                    : "blue"
                }
                size="lg"
                label={`${Math.round(
                  storageHealth.chromeStorage.usagePercentage * 100
                )}%`}
              />
            </div>
          )}
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <Title order={4} mb="md">
          Quick Actions
        </Title>
        <Group>
          <Button
            leftSection={<IconTrash size={16} />}
            color="orange"
            onClick={() => setActiveTab("cleanup")}
          >
            Cleanup Storage
          </Button>
          <Button
            leftSection={<IconUpload size={16} />}
            color="blue"
            onClick={() => setActiveTab("migration")}
          >
            Migration Tools
          </Button>
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={() => alert("Export functionality coming soon")}
          >
            Export Data
          </Button>
        </Group>
      </Card>
    </div>
  );

  // Cleanup Tab Component
  const CleanupTab = () => (
    <div>
      <Title order={3} mb="lg">
        Storage Cleanup
      </Title>

      {cleanupRecommendations && (
        <Card mb="lg">
          <Title order={4} mb="md">
            Cleanup Recommendations
            <Badge ml="xs" color="blue">
              Est. {formatBytes(cleanupRecommendations.totalEstimatedSavings)}
            </Badge>
          </Title>

          <Accordion>
            <Accordion.Item value="indexeddb">
              <Accordion.Control icon={<IconDatabase size={20} />}>
                IndexedDB Cleanup (
                {cleanupRecommendations.indexedDB?.actions?.length || 0}{" "}
                actions)
              </Accordion.Control>
              <Accordion.Panel>
                {cleanupRecommendations.indexedDB?.actions?.map(
                  (action, index) => (
                    <Group position="apart" key={index} p="sm">
                      <div>
                        <Badge
                          size="xs"
                          color={
                            action.priority === "critical"
                              ? "red"
                              : action.priority === "high"
                              ? "orange"
                              : "blue"
                          }
                          mb={4}
                        >
                          {action.priority}
                        </Badge>
                        <Text size="sm">{action.description}</Text>
                      </div>
                      <Text size="xs" color="dimmed">
                        {action.estimatedSavings}
                      </Text>
                    </Group>
                  )
                )}
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="chrome">
              <Accordion.Control icon={<IconCloudUpload size={20} />}>
                Chrome Storage Cleanup (
                {cleanupRecommendations.chromeStorage?.actions?.length || 0}{" "}
                actions)
              </Accordion.Control>
              <Accordion.Panel>
                {cleanupRecommendations.chromeStorage?.actions?.map(
                  (action, index) => (
                    <Group position="apart" key={index} p="sm">
                      <div>
                        <Badge
                          size="xs"
                          color={
                            action.priority === "critical"
                              ? "red"
                              : action.priority === "high"
                              ? "orange"
                              : "blue"
                          }
                          mb={4}
                        >
                          {action.priority}
                        </Badge>
                        <Text size="sm">{action.description}</Text>
                      </div>
                      <Text size="xs" color="dimmed">
                        {action.estimatedSavings}
                      </Text>
                    </Group>
                  )
                )}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <Group mt="md">
            <Button
              color="orange"
              onClick={async () => {
                try {
                  await StorageCleanupManager.performAutomaticCleanup();
                  addNotification("success", "Cleanup completed successfully");
                  loadStorageData();
                } catch (error) {
                  addNotification("error", "Cleanup failed");
                }
              }}
            >
              Run Automatic Cleanup
            </Button>
            <Button
              color="red"
              variant="light"
              onClick={async () => {
                try {
                  await StorageCleanupManager.emergencyCleanup();
                  addNotification("success", "Emergency cleanup completed");
                  loadStorageData();
                } catch (error) {
                  addNotification("error", "Emergency cleanup failed");
                }
              }}
            >
              Emergency Cleanup
            </Button>
          </Group>
        </Card>
      )}

      {/* Cleanup Settings */}
      <Card>
        <Title order={4} mb="md">
          Cleanup Settings
        </Title>
        <Group>
          <Switch
            label="Automatic Cleanup"
            description="Automatically cleanup old data when storage is low"
            checked={autoCleanup}
            onChange={(event) => setAutoCleanup(event.currentTarget.checked)}
          />
        </Group>
      </Card>
    </div>
  );

  // Migration Tab Component
  const MigrationTab = () => (
    <div>
      <Title order={3} mb="lg">
        Data Migration
      </Title>

      {/* Migration History */}
      <Card mb="lg">
        <Title order={4} mb="md">
          Recent Migrations
        </Title>

        {migrationHistory.length === 0 ? (
          <Text color="dimmed" ta="center">
            No migrations found
          </Text>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Items</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {migrationHistory.map((migration) => (
                <tr key={migration.id}>
                  <td>
                    <Code size="xs">{migration.id.split("_").pop()}</Code>
                  </td>
                  <td>
                    <Badge size="sm" variant="dot">
                      {migration.type}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      size="sm"
                      color={
                        migration.state === "completed"
                          ? "green"
                          : migration.state === "failed"
                          ? "red"
                          : "blue"
                      }
                    >
                      {migration.state}
                    </Badge>
                  </td>
                  <td>{formatDuration(migration.duration)}</td>
                  <td>
                    {migration.migratedItems || migration.restoredItems || 0}
                  </td>
                  <td>{new Date(migration.startTime).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Migration Controls */}
      <Card>
        <Title order={4} mb="md">
          Migration Tools
        </Title>
        <Group>
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={async () => {
              try {
                const result = await StorageMigrationService.migrateToChrome();
                if (result.success) {
                  addNotification(
                    "success",
                    "Migration to Chrome Storage completed"
                  );
                } else {
                  addNotification("error", "Migration failed");
                }
                loadStorageData();
              } catch (error) {
                addNotification("error", "Migration failed");
              }
            }}
          >
            Backup to Chrome Storage
          </Button>
          <Button
            leftSection={<IconDownload size={16} />}
            color="blue"
            onClick={async () => {
              try {
                const result =
                  await StorageMigrationService.migrateFromChrome();
                if (result.success) {
                  addNotification(
                    "success",
                    "Restore from Chrome Storage completed"
                  );
                } else {
                  addNotification("error", "Restore failed");
                }
                loadStorageData();
              } catch (error) {
                addNotification("error", "Restore failed");
              }
            }}
          >
            Restore from Chrome Storage
          </Button>
        </Group>
      </Card>
    </div>
  );

  // Settings Tab Component
  const SettingsTab = () => (
    <div>
      <Title order={3} mb="lg">
        Storage Configuration
      </Title>

      <Card mb="lg">
        <Title order={4} mb="md">
          Fallback Settings
        </Title>
        <Select
          label="Fallback Mode"
          description="How the system should handle storage failures"
          value={fallbackMode}
          onChange={setFallbackMode}
          data={[
            { value: "auto", label: "Automatic - Switch based on health" },
            { value: "manual", label: "Manual - User controlled switching" },
            { value: "always_fallback", label: "Always use Chrome Storage" },
          ]}
          mb="md"
        />

        <NumberInput
          label="Sync Interval (seconds)"
          description="How often to sync critical data to fallback storage"
          value={syncInterval}
          onChange={setSyncInterval}
          min={10}
          max={300}
        />
      </Card>

      <Card>
        <Title order={4} mb="md">
          Advanced Options
        </Title>
        <Group>
          <Switch
            label="Enable Compression"
            description="Compress data when storing in Chrome Storage"
            defaultChecked
          />
          <Switch
            label="Health Monitoring"
            description="Continuously monitor storage health"
            defaultChecked
          />
        </Group>
      </Card>
    </div>
  );

  return (
    <Container size="xl" py="md">
      <Group position="apart" mb="lg">
        <div>
          <Title order={1}>Storage Management</Title>
          <Text color="dimmed">
            Monitor and manage your CodeMaster data storage
          </Text>
        </div>
        <StorageStatusIndicator position="header" />
      </Group>

      {/* Notifications */}
      <div
        style={{ position: "fixed", top: "20px", right: "20px", zIndex: 1000 }}
      >
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            color={
              notification.type === "error"
                ? "red"
                : notification.type === "success"
                ? "green"
                : "blue"
            }
            onClose={() =>
              setNotifications((prev) =>
                prev.filter((n) => n.id !== notification.id)
              )
            }
            mb="xs"
          >
            {notification.message}
          </Notification>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Loader size="lg" />
          <Text mt="md">Loading storage information...</Text>
        </div>
      ) : (
        <Tabs value={activeTab} onTabChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" icon={<IconInfoCircle size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="cleanup" icon={<IconTrash size={16} />}>
              Cleanup
            </Tabs.Tab>
            <Tabs.Tab value="migration" icon={<IconUpload size={16} />}>
              Migration
            </Tabs.Tab>
            <Tabs.Tab value="settings" icon={<IconSettings size={16} />}>
              Settings
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <OverviewTab />
          </Tabs.Panel>

          <Tabs.Panel value="cleanup" pt="md">
            <CleanupTab />
          </Tabs.Panel>

          <Tabs.Panel value="migration" pt="md">
            <MigrationTab />
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="md">
            <SettingsTab />
          </Tabs.Panel>
        </Tabs>
      )}
    </Container>
  );
};

export default StorageSettings;
