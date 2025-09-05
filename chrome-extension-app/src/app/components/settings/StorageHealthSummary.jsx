/**
 * Storage Health Summary Component
 * 
 * Displays storage status indicators and usage charts for both IndexedDB and Chrome Storage
 */
import React from "react";
import {
  Title,
  Text,
  Group,
  Card,
  Badge,
  Progress,
} from "@mantine/core";
import {
  IconCheck,
  IconX,
} from "@tabler/icons-react";

export const StorageHealthSummary = ({ storageHealth, formatBytes }) => {
  if (!storageHealth) return null;

  return (
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
  );
};

export default StorageHealthSummary;