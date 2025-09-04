/**
 * Migration Tab Component for Storage Settings
 *
 * Displays migration history and tools for data migration between storage types.
 */
import React from "react";
import {
  Title,
  Group,
  Button,
  Card,
} from "@mantine/core";
import {
  IconUpload,
  IconDownload,
} from "@tabler/icons-react";
import { MigrationHistoryTable } from "./MigrationHistoryTable.jsx";

export const MigrationTab = ({
  migrationHistory,
  formatDuration,
  StorageMigrationService,
  addNotification,
  loadStorageData,
}) => {
  return (
    <div>
      <Title order={3} mb="lg">
        Data Migration
      </Title>

      {/* Migration History */}
      <Card mb="lg">
        <Title order={4} mb="md">
          Recent Migrations
        </Title>

        <MigrationHistoryTable 
          migrationHistory={migrationHistory} 
          formatDuration={formatDuration} 
        />
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
};