import React from "react";
import { Modal, Stack, Text, Alert, Button, Group } from "@mantine/core";
import { IconInfoCircle, IconCheck, IconX } from "@tabler/icons-react";

// Import validation modal component
export function ImportValidationModal({ 
  isOpen, 
  onClose, 
  validationResult, 
  onConfirm, 
  fileName 
}) {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Import Settings Validation"
      size="md"
    >
      <Stack gap="md">
        <Text size="sm">
          Validating settings from: <strong>{fileName}</strong>
        </Text>
        
        {validationResult?.errors?.length > 0 && (
          <Alert color="red" variant="light" icon={<IconX size={16} />}>
            <Text size="sm" fw={500} mb="xs">Errors found:</Text>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {validationResult.errors.map((error, index) => (
                <li key={index}><Text size="sm">{error}</Text></li>
              ))}
            </ul>
          </Alert>
        )}
        
        {validationResult?.warnings?.length > 0 && (
          <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />}>
            <Text size="sm" fw={500} mb="xs">Warnings:</Text>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {validationResult.warnings.map((warning, index) => (
                <li key={index}><Text size="sm">{warning}</Text></li>
              ))}
            </ul>
          </Alert>
        )}
        
        {validationResult?.isValid && (
          <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
            Settings file is valid and ready to import
          </Alert>
        )}
        
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!validationResult?.isValid}
            color={validationResult?.isValid ? "green" : "red"}
          >
            {validationResult?.isValid ? "Import Settings" : "Cannot Import"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}