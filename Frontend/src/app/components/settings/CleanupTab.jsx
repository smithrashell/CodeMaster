/**
 * Cleanup Tab Component for Storage Settings
 *
 * Displays cleanup recommendations and tools for storage maintenance.
 */
import React from "react";
import {
  Title,
  Text,
  Group,
  Button,
  Card,
} from "@mantine/core";
import { CleanupRecommendationsSection } from "./CleanupRecommendationsSection.jsx";

export const CleanupTab = ({
  cleanupRecommendations,
  formatBytes,
  StorageCleanupManager,
  addNotification,
  loadStorageData,
}) => {
  return (
    <div>
      <Title order={3} mb="lg">
        Storage Cleanup
      </Title>

      <CleanupRecommendationsSection 
        cleanupRecommendations={cleanupRecommendations} 
        formatBytes={formatBytes} 
      />

      {/* Manual Cleanup Actions */}
      <Card>
        <Title order={4} mb="md">
          Manual Cleanup Actions
        </Title>
        <Group>
          <Button
            color="orange"
            onClick={async () => {
              try {
                await StorageCleanupManager.performAutomaticCleanup();
                addNotification("success", "Cleanup completed successfully");
                await loadStorageData();
              } catch (error) {
                addNotification("error", "Cleanup failed");
              }
            }}
          >
            Run Automatic Cleanup
          </Button>
          <Button
            variant="light"
            color="orange"
            onClick={() => addNotification("info", "Manual cleanup tools coming soon")}
          >
            Custom Cleanup
          </Button>
        </Group>
        <Text size="sm" color="dimmed" mt="xs">
          Automatic cleanup will remove expired sessions, duplicate entries, and orphaned data.
        </Text>
      </Card>
    </div>
  );
};