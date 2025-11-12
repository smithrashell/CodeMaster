import React, { useState } from "react";
import { Button, Modal, Text, Group, Alert } from "@mantine/core";
import { IconRefresh, IconTrash, IconAlertTriangle } from "@tabler/icons-react";

// Individual Settings Reset Button Component
export function SettingsResetButton({ 
  onReset, 
  disabled = false,
  settingsType = "these settings",
  size = "sm",
  variant = "light"
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
      setIsModalOpen(false);
    } catch (error) {
      // Error handling is done by the parent component
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Button
        leftSection={<IconRefresh size={16} />}
        variant={variant}
        color="gray"
        size={size}
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
      >
        Reset to Defaults
      </Button>

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Reset Settings"
        size="sm"
      >
        <Alert 
          color="yellow" 
          variant="light" 
          icon={<IconAlertTriangle size={16} />}
          mb="md"
        >
          This action cannot be undone
        </Alert>
        
        <Text size="sm" mb="lg">
          Are you sure you want to reset {settingsType} to their default values? 
          All your customizations will be lost.
        </Text>

        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={() => setIsModalOpen(false)}
            disabled={isResetting}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleReset}
            loading={isResetting}
            leftSection={<IconTrash size={16} />}
          >
            Reset Settings
          </Button>
        </Group>
      </Modal>
    </>
  );
}

// Global Settings Reset Button Component  
export function GlobalSettingsResetButton({ onReset, disabled = false }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
      setIsModalOpen(false);
    } catch (error) {
      // Error handling is done by the parent component
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Button
        leftSection={<IconRefresh size={16} />}
        variant="outline"
        color="red"
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
      >
        Reset All Settings
      </Button>

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Reset All Settings"
        size="md"
      >
        <Alert 
          color="red" 
          variant="light" 
          icon={<IconAlertTriangle size={16} />}
          mb="md"
        >
          <Text fw={500}>Warning: This will reset everything!</Text>
        </Alert>
        
        <Text size="sm" mb="md">
          This will reset <strong>all</strong> your settings to their default values, including:
        </Text>

        <ul style={{ marginBottom: '20px', paddingLeft: '20px' }}>
          <li>Focus areas and learning preferences</li>
          <li>Session configuration and adaptive settings</li>
          <li>Timer display and notification preferences</li>
          <li>Dashboard layout and chart customizations</li>
          <li>Theme and appearance settings</li>
        </ul>

        <Text size="sm" mb="lg">
          Consider exporting your settings first as a backup. This action cannot be undone.
        </Text>

        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={() => setIsModalOpen(false)}
            disabled={isResetting}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleReset}
            loading={isResetting}
            leftSection={<IconTrash size={16} />}
          >
            Reset All Settings
          </Button>
        </Group>
      </Modal>
    </>
  );
}