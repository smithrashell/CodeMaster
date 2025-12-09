/**
 * Storage Status Indicator Component
 *
 * Displays current storage health, mode, and provides quick access to storage management
 * features like cleanup, migration, and health monitoring.
 */

import React, { useState, useEffect } from "react";
import { Modal } from "@mantine/core";
import ResilientStorage from "../services/ResilientStorage.js";
import StorageCleanupManager from "../utils/storageCleanup.js";
import {
  useStorageStatusHelpers,
  useStorageRenderHelpers,
  StorageDetailModal,
} from "./StorageStatusHelpers.jsx";

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

export default StorageStatusIndicator;
