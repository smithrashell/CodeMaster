/**
 * Custom hook for loading and managing storage data
 */
import { useState, useEffect, useCallback } from "react";
import StorageHealthMonitor from "../../shared/utils/storageHealth.js";
import StorageCleanupManager from "../../shared/utils/storageCleanup.js";
import StorageMigrationService from "../../shared/services/StorageMigrationService.js";

export const useStorageData = (addNotification) => {
  const [storageHealth, setStorageHealth] = useState(null);
  const [cleanupRecommendations, setCleanupRecommendations] = useState(null);
  const [migrationHistory, setMigrationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
  }, [addNotification]);

  useEffect(() => {
    loadStorageData();
  }, [loadStorageData]);

  return {
    storageHealth,
    cleanupRecommendations,
    migrationHistory,
    isLoading,
    loadStorageData,
  };
};