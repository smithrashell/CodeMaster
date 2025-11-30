/**
 * Storage Settings Page Component
 *
 * Comprehensive storage management interface providing health monitoring,
 * cleanup tools, migration controls, and advanced storage configuration options.
 */

import React, { useState } from "react";
import {
  Container,
  Title,
  Text,
  Group,
  Tabs,
} from "@mantine/core";
import {
  IconInfoCircle,
  IconTrash,
  IconUpload,
  IconSettings,
} from "@tabler/icons-react";
import StorageStatusIndicator from "../../shared/components/StorageStatusIndicator.jsx";
import { formatBytes, formatDuration } from "./storageSettingsHelpers.js";
import { OverviewTab } from "../components/settings/OverviewTab.jsx";
import { CleanupTab } from "../components/settings/CleanupTab.jsx";
import { MigrationTab } from "../components/settings/MigrationTab.jsx";
import { SettingsTab } from "../components/settings/SettingsTab.jsx";
import { StorageNotifications } from "../components/settings/StorageNotifications.jsx";
import { StorageLoadingState } from "../components/settings/StorageLoadingState.jsx";
import { useStorageData } from "../hooks/useStorageData.js";
import StorageCleanupManager from "../../shared/utils/storage/storageCleanup.js";
import ChromeAPIErrorHandler from "../../shared/services/chrome/ChromeAPIErrorHandler.js";

// Storage Header Component
const StorageHeader = () => (
  <Group position="apart" mb="lg">
    <div>
      <Title order={1}>Storage Management</Title>
      <Text color="dimmed">
        Monitor and manage your CodeMaster data storage
      </Text>
    </div>
    <StorageStatusIndicator position="header" />
  </Group>
);

// Storage Migration Actions Hook
const useStorageMigrationActions = () => {
  return {
    runMigration: async (migrationData) => {
      try {
        return await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: "runStorageMigration",
          migrationData
        });
      } catch (error) {
        console.error("Storage migration failed:", error);
        throw error;
      }
    },
    getMigrationStatus: async () => {
      try {
        return await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: "getStorageMigrationStatus"
        });
      } catch (error) {
        console.error("Failed to get migration status:", error);
        throw error;
      }
    }
  };
};

// Storage Tab Panels Component
const StorageTabPanels = ({
  storageHealth,
  cleanupRecommendations,
  migrationHistory,
  isLoading,
  loadStorageData,
  addNotification,
  fallbackMode,
  setFallbackMode,
  syncInterval,
  setSyncInterval,
  autoCleanup,
  setAutoCleanup,
  setActiveTab,
  storageMigrationActions
}) => (
  <>
    <Tabs.Panel value="overview" pt="md">
      <OverviewTab
        loadStorageData={loadStorageData}
        isLoading={isLoading}
        storageHealth={storageHealth}
        formatBytes={formatBytes}
        setActiveTab={setActiveTab}
      />
    </Tabs.Panel>

    <Tabs.Panel value="cleanup" pt="md">
      <CleanupTab
        cleanupRecommendations={cleanupRecommendations}
        formatBytes={formatBytes}
        StorageCleanupManager={StorageCleanupManager}
        addNotification={addNotification}
        loadStorageData={loadStorageData}
      />
    </Tabs.Panel>

    <Tabs.Panel value="migration" pt="md">
      <MigrationTab
        migrationHistory={migrationHistory}
        formatDuration={formatDuration}
        storageMigrationActions={storageMigrationActions}
        addNotification={addNotification}
        loadStorageData={loadStorageData}
      />
    </Tabs.Panel>

    <Tabs.Panel value="settings" pt="md">
      <SettingsTab
        fallbackMode={fallbackMode}
        setFallbackMode={setFallbackMode}
        syncInterval={syncInterval}
        setSyncInterval={setSyncInterval}
        autoCleanup={autoCleanup}
        setAutoCleanup={setAutoCleanup}
      />
    </Tabs.Panel>
  </>
);

export function StorageSettings() {
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);

  // Settings states
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30);
  const [fallbackMode, setFallbackMode] = useState("auto");

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

  const {
    storageHealth,
    cleanupRecommendations,
    migrationHistory,
    isLoading,
    loadStorageData,
  } = useStorageData(addNotification);

  const storageMigrationActions = useStorageMigrationActions();

  return (
    <Container size="xl" py="md">
      <StorageHeader />

      <StorageNotifications 
        notifications={notifications} 
        setNotifications={setNotifications} 
      />

      {isLoading ? (
        <StorageLoadingState />
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

          <StorageTabPanels
            storageHealth={storageHealth}
            cleanupRecommendations={cleanupRecommendations}
            migrationHistory={migrationHistory}
            isLoading={isLoading}
            loadStorageData={loadStorageData}
            addNotification={addNotification}
            fallbackMode={fallbackMode}
            setFallbackMode={setFallbackMode}
            syncInterval={syncInterval}
            setSyncInterval={setSyncInterval}
            autoCleanup={autoCleanup}
            setAutoCleanup={setAutoCleanup}
            setActiveTab={setActiveTab}
            storageMigrationActions={storageMigrationActions}
          />
        </Tabs>
      )}
    </Container>
  );
}

export default StorageSettings;
