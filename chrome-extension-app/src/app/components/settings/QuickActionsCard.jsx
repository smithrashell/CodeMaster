/**
 * Quick Actions Card Component
 * 
 * Provides quick access buttons for storage management operations
 */
import React from "react";
import {
  Title,
  Group,
  Button,
  Card,
} from "@mantine/core";
import {
  IconTrash,
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";

export const QuickActionsCard = ({ setActiveTab }) => {
  return (
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
  );
};

export default QuickActionsCard;