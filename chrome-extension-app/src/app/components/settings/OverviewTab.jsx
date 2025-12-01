/**
 * Overview Tab Component for Storage Settings
 *
 * Displays storage overview, health summary, and quick actions.
 */
import React from "react";
import {
  Title,
  Group,
  Button,
  Card,
} from "@mantine/core";
import {
  IconRefresh,
} from "@tabler/icons-react";
import StorageStatusIndicator from "../../../shared/components/storage/StorageStatusIndicator.jsx";
import { StorageHealthSummary } from "./StorageHealthSummary.jsx";
import { QuickActionsCard } from "./QuickActionsCard.jsx";

export const OverviewTab = ({
  loadStorageData,
  isLoading,
  storageHealth,
  formatBytes,
  setActiveTab,
}) => {
  return (
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
      <StorageHealthSummary storageHealth={storageHealth} formatBytes={formatBytes} />

      {/* Quick Actions */}
      <QuickActionsCard setActiveTab={setActiveTab} />
    </div>
  );
};

export default OverviewTab;