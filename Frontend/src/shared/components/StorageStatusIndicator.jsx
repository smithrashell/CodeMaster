/**
 * Storage Status Indicator Component
 *
 * Displays current storage health, mode, and provides quick access to storage management
 * features like cleanup, migration, and health monitoring.
 */

import React, { useState, useEffect } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconRefresh,
  IconCloudUpload,
  IconHardDrive,
  IconSettings,
} from "@tabler/icons-react";
import {
  Tooltip,
  Badge,
  ActionIcon,
  Group,
  Text,
  Progress,
  Modal,
  Button,
} from "@mantine/core";

import ResilientStorage from "../services/ResilientStorage.js";
import StorageCleanupManager from "../utils/storageCleanup.js";

/**
 * Storage Status Helper Functions
 */
const _useStorageHelpers = (storageStatus, size) => {
  const getStatusColor = () => {
    if (!storageStatus.isIndexedDBAvailable && !storageStatus.isChromeStorageAvailable) {
      return "red";
    }
    if (storageStatus.quotaWarning) {
      return "yellow";
    }
    if (storageStatus.mode === "chrome_fallback") {
      return "orange";
    }
    return "green";
  };

  const getStatusIcon = () => {
    const color = getStatusColor();
    const iconSize = size === "xs" ? 14 : size === "sm" ? 16 : 20;

    if (color === "red") {
      return <IconX size={iconSize} color="red" />;
    }
    if (color === "yellow" || color === "orange") {
      return <IconAlertTriangle size={iconSize} color={color} />;
    }
    return <IconCheck size={iconSize} color="green" />;
  };

  const getStatusText = () => {
    if (!storageStatus.isIndexedDBAvailable && !storageStatus.isChromeStorageAvailable) {
      return "Storage Unavailable";
    }
    if (storageStatus.quotaWarning) {
      return "Storage Nearly Full";
    }
    if (storageStatus.mode === "chrome_fallback") {
      return "Fallback Mode";
    }
    return "Storage Healthy";
  };

  const getStorageIcon = () => {
    if (storageStatus.mode === "chrome_fallback") {
      return <IconCloudUpload size={16} />;
    }
    return <IconHardDrive size={16} />;
  };

  return { getStatusColor, getStatusIcon, getStatusText, getStorageIcon };
};

/**
 * Status-based styling helpers
 */
const useStorageStatusHelpers = (storageStatus, size) => {
  const getStatusColor = () => {
    if (
      !storageStatus.isIndexedDBAvailable &&
      !storageStatus.isChromeStorageAvailable
    ) {
      return "red";
    }
    if (storageStatus.quotaWarning) {
      return "yellow";
    }
    if (storageStatus.mode === "chrome_fallback") {
      return "orange";
    }
    return "green";
  };

  const getStatusIcon = () => {
    const color = getStatusColor();
    const iconSize = size === "xs" ? 14 : size === "sm" ? 16 : 20;

    if (color === "red") {
      return <IconX size={iconSize} color="red" />;
    }
    if (color === "yellow" || color === "orange") {
      return <IconAlertTriangle size={iconSize} color={color} />;
    }
    return <IconCheck size={iconSize} color="green" />;
  };

  const getStatusText = () => {
    if (
      !storageStatus.isIndexedDBAvailable &&
      !storageStatus.isChromeStorageAvailable
    ) {
      return "Storage Unavailable";
    }
    if (storageStatus.quotaWarning) {
      return "Storage Nearly Full";
    }
    if (storageStatus.mode === "chrome_fallback") {
      return "Fallback Mode";
    }
    return "Storage Healthy";
  };

  const getStorageIcon = () => {
    if (storageStatus.mode === "chrome_fallback") {
      return <IconCloudUpload size={16} />;
    }
    return <IconHardDrive size={16} />;
  };

  return { getStatusColor, getStatusIcon, getStatusText, getStorageIcon };
};

/**
 * Render function helpers
 */
const useStorageRenderHelpers = ({
  storageStatus,
  statusHelpers,
  size,
  showDetails,
  isRefreshing,
  setShowModal,
  handleRefresh,
}) => {
  const renderHeaderVersion = () => (
    <Tooltip
      label={`Storage: ${statusHelpers.getStatusText()} - Click for details`}
      position="bottom"
      withArrow
    >
      <ActionIcon
        variant="subtle"
        color={statusHelpers.getStatusColor()}
        size={size}
        onClick={() => setShowModal(true)}
      >
        {statusHelpers.getStatusIcon()}
      </ActionIcon>
    </Tooltip>
  );

  const renderSettingsVersion = () => (
    <Group spacing="xs">
      {statusHelpers.getStorageIcon()}
      <div>
        <Text size="sm" weight={500}>
          Storage Status
        </Text>
        <Group spacing="xs">
          {statusHelpers.getStatusIcon()}
          <Text size="xs" color="dimmed">
            {statusHelpers.getStatusText()}
          </Text>
          <Badge size="xs" color={statusHelpers.getStatusColor()} variant="dot">
            {storageStatus.mode.replace("_", " ").toUpperCase()}
          </Badge>
        </Group>
      </div>
      <ActionIcon size="sm" variant="subtle" onClick={() => setShowModal(true)}>
        <IconSettings size={14} />
      </ActionIcon>
    </Group>
  );

  const renderStandaloneVersion = () => (
    <div
      style={{
        padding: "12px",
        border: `1px solid var(--mantine-color-${statusHelpers.getStatusColor()}-3)`,
        borderRadius: "8px",
        backgroundColor: `var(--mantine-color-${statusHelpers.getStatusColor()}-0)`,
      }}
    >
      <Group position="apart" mb="xs">
        <Group spacing="xs">
          {statusHelpers.getStorageIcon()}
          <Text weight={500}>Storage System</Text>
        </Group>
        <ActionIcon
          size="sm"
          variant="subtle"
          loading={isRefreshing}
          onClick={handleRefresh}
        >
          <IconRefresh size={14} />
        </ActionIcon>
      </Group>

      <Group spacing="xs" mb="xs">
        {statusHelpers.getStatusIcon()}
        <Text size="sm">{statusHelpers.getStatusText()}</Text>
        <Badge size="sm" color={statusHelpers.getStatusColor()}>
          {storageStatus.mode.replace("_", " ").toUpperCase()}
        </Badge>
      </Group>

      {storageStatus.health?.indexedDB?.usagePercentage && (
        <div>
          <Text size="xs" color="dimmed" mb={4}>
            IndexedDB Usage
          </Text>
          <Progress
            value={storageStatus.health.indexedDB.usagePercentage * 100}
            color={
              storageStatus.health.indexedDB.usagePercentage > 0.8
                ? "red"
                : "blue"
            }
            size="sm"
          />
        </div>
      )}

      {showDetails && (
        <Button
          size="xs"
          variant="subtle"
          mt="xs"
          onClick={() => setShowModal(true)}
        >
          View Details
        </Button>
      )}
    </div>
  );

  return { renderHeaderVersion, renderSettingsVersion, renderStandaloneVersion };
};

export const StorageStatusIndicator = ({
  showDetails = true,
  size = "sm",
  position = "header", // 'header', 'settings', 'standalone'
}) => {
  const [storageStatus, setStorageStatus] = useState({
    mode: "indexeddb_primary",
    health: { overall: "good" },
    isIndexedDBAvailable: true,
    isChromeStorageAvailable: true,
    quotaWarning: false,
  });

  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cleanupRecommendations, setCleanupRecommendations] = useState(null);

  // Status monitoring
  useEffect(() => {
    updateStorageStatus();

    // Set up periodic status updates
    const interval = setInterval(updateStorageStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const updateStorageStatus = async () => {
    try {
      const status = await ResilientStorage.getStorageStatus();
      setStorageStatus(status);

      // Get cleanup recommendations if quota warning
      if (status.quotaWarning) {
        const recommendations =
          await StorageCleanupManager.getCleanupRecommendations();
        setCleanupRecommendations(recommendations);
      }
    } catch (error) {
      console.error("Failed to update storage status:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await updateStorageStatus();
    setTimeout(() => setIsRefreshing(false), 500); // Visual feedback
  };

  const handleEmergencyCleanup = async () => {
    try {
      await StorageCleanupManager.emergencyCleanup();
      await updateStorageStatus();
    } catch (error) {
      console.error("Emergency cleanup failed:", error);
    }
  };

  // Use extracted status helpers
  const statusHelpers = useStorageStatusHelpers(storageStatus, size);

  // Use extracted render helpers
  const renderHelpers = useStorageRenderHelpers({
    storageStatus,
    statusHelpers,
    size,
    showDetails,
    isRefreshing,
    setShowModal,
    handleRefresh,
  });

  const renderModal = () => (
    <Modal
      opened={showModal}
      onClose={() => setShowModal(false)}
      title="Storage System Status"
      size="lg"
    >
      <StorageDetailModal
        status={storageStatus}
        recommendations={cleanupRecommendations}
        onRefresh={updateStorageStatus}
        onEmergencyCleanup={handleEmergencyCleanup}
      />
    </Modal>
  );

  return (
    <>
      {position === "header" && renderHelpers.renderHeaderVersion()}
      {position === "settings" && renderHelpers.renderSettingsVersion()}
      {position === "standalone" && renderHelpers.renderStandaloneVersion()}
      {renderModal()}
    </>
  );
};

/**
 * Storage detail modal helper components
 */
const OverviewHeader = ({ onRefresh }) => (
  <Group position="apart" mb="lg">
    <Text weight={500} size="lg">
      Storage Overview
    </Text>
    <Button variant="subtle" size="sm" onClick={onRefresh}>
      <IconRefresh size={16} />
      Refresh
    </Button>
  </Group>
);

const ActionItem = ({ action, index, keyPrefix = "" }) => (
  <div
    key={`${keyPrefix}${index}`}
    style={{
      padding: "12px",
      border: "1px solid var(--mantine-color-gray-3)",
      borderRadius: "6px",
      marginBottom: "8px",
    }}
  >
    <Group position="apart">
      <div>
        <Badge
          size="sm"
          color={
            action.priority === "critical"
              ? "red"
              : action.priority === "high"
              ? "orange"
              : "blue"
          }
        >
          {action.priority}
        </Badge>
        <Text size="sm" mt={4}>
          {action.description}
        </Text>
      </div>
      <Text size="xs" color="dimmed">
        {action.estimatedSavings}
      </Text>
    </Group>
  </div>
);

const RecommendationsList = ({ recommendations }) => (
  <div>
    <Text weight={500} size="lg" mb="md">
      Cleanup Recommendations
    </Text>

    {recommendations ? (
      <div>
        {recommendations.indexedDB?.actions?.map((action, index) => (
          <ActionItem action={action} index={index} key={index} />
        ))}

        {recommendations.chromeStorage?.actions?.map((action, index) => (
          <ActionItem action={action} index={index} keyPrefix="chrome-" key={`chrome-${index}`} />
        ))}
      </div>
    ) : (
      <Text color="dimmed">No cleanup recommendations at this time.</Text>
    )}
  </div>
);

const TabNavigation = ({ activeTab, setActiveTab }) => (
  <Group spacing="lg" mb="lg">
    <Button
      variant={activeTab === "overview" ? "filled" : "subtle"}
      size="sm"
      onClick={() => setActiveTab("overview")}
    >
      Overview
    </Button>
    <Button
      variant={activeTab === "recommendations" ? "filled" : "subtle"}
      size="sm"
      onClick={() => setActiveTab("recommendations")}
    >
      Recommendations
    </Button>
  </Group>
);

const StatusBadges = ({ status }) => (
  <div style={{ marginBottom: "20px" }}>
    <Group spacing="lg">
      <div>
        <Text size="sm" color="dimmed">
          Current Mode
        </Text>
        <Badge
          size="lg"
          color={status.mode === "chrome_fallback" ? "orange" : "blue"}
        >
          {status.mode?.replace("_", " ").toUpperCase()}
        </Badge>
      </div>
      <div>
        <Text size="sm" color="dimmed">
          Overall Health
        </Text>
        <Badge
          size="lg"
          color={
            status.health?.overall === "excellent"
              ? "green"
              : status.health?.overall === "good"
              ? "blue"
              : status.health?.overall === "warning"
              ? "yellow"
              : "red"
          }
        >
          {status.health?.overall?.toUpperCase()}
        </Badge>
      </div>
    </Group>
  </div>
);

const StorageSection = ({ icon, title, isAvailable, health, formatBytes }) => (
  <div style={{ marginBottom: "20px" }}>
    <Group spacing="xs" mb="xs">
      {icon}
      <Text weight={500}>{title}</Text>
      <Badge
        size="sm"
        color={isAvailable ? "green" : "red"}
        variant="dot"
      >
        {isAvailable ? "Available" : "Unavailable"}
      </Badge>
    </Group>

    {health?.quota && (
      <div>
        <Text size="xs" color="dimmed">
          Used: {formatBytes(health.used || health.bytesInUse)} /
          {formatBytes(health.quota)}
        </Text>
        <Progress
          value={health.usagePercentage * 100}
          color={health.usagePercentage > 0.8 ? "red" : "blue"}
          size="sm"
          mt={4}
        />
      </div>
    )}
  </div>
);

// Detailed modal component
const StorageDetailModal = ({
  status,
  recommendations,
  onRefresh,
  onEmergencyCleanup,
}) => {
  const [activeTab, setActiveTab] = useState("overview");

  const formatBytes = (bytes) => {
    if (!bytes) return "Unknown";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 10) / 10 + " " + sizes[i];
  };

  function renderOverview() {
    return (
    <div>
      <OverviewHeader onRefresh={onRefresh} />
      <StatusBadges status={status} />

      <StorageSection 
        icon={<IconHardDrive size={16} />}
        title="IndexedDB"
        isAvailable={status.isIndexedDBAvailable}
        health={status.health?.indexedDB}
        formatBytes={formatBytes}
      />

      <StorageSection 
        icon={<IconCloudUpload size={16} />}
        title="Chrome Storage"
        isAvailable={status.isChromeStorageAvailable}
        health={status.health?.chromeStorage}
        formatBytes={formatBytes}
      />

      {/* Actions */}
      {status.quotaWarning && (
        <Group mt="lg">
          <Button color="red" variant="light" onClick={onEmergencyCleanup}>
            Emergency Cleanup
          </Button>
        </Group>
      )}
    </div>
    );
  }


  return (
    <div>
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === "overview" && renderOverview()}
      {activeTab === "recommendations" && <RecommendationsList recommendations={recommendations} />}
    </div>
  );
};

export default StorageStatusIndicator;
