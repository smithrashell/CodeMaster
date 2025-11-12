import React, { useRef } from "react";
import { Card, Text, Title, Stack, Button, Alert, FileInput } from "@mantine/core";
import { IconDownload, IconUpload, IconFileCode } from "@tabler/icons-react";
import { GlobalSettingsResetButton } from "./SettingsResetButton.jsx";
import { useSettingsExport, useSettingsImport } from "./useSettingsExportImport.js";
import { ImportValidationModal } from "./ImportValidationModal.jsx";

export function SettingsExportImport() {
  const fileInputRef = useRef();
  
  // Use custom hooks for export/import functionality
  const { isExporting, exportStatus, handleExport } = useSettingsExport();
  const {
    isImporting,
    importStatus,
    validationModal,
    setValidationModal,
    handleFileSelect,
    handleImportConfirm,
    handleGlobalReset
  } = useSettingsImport();


  return (
    <>
      <Card withBorder p="lg" radius="md">
        <Stack gap="md">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconFileCode size={20} />
            <Title order={4}>Settings Management</Title>
          </div>

          <Text size="sm">
            Export your settings for backup or import previously saved settings.
          </Text>

          {/* Status Messages */}
          {exportStatus && (
            <Alert 
              color={exportStatus.type === "success" ? "green" : "red"} 
              variant="light"
            >
              {exportStatus.message}
            </Alert>
          )}
          
          {importStatus && (
            <Alert 
              color={importStatus.type === "success" ? "green" : "red"} 
              variant="light"
            >
              {importStatus.message}
            </Alert>
          )}

          {/* Export Section */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>Export Settings</Text>
            <Text size="xs">
              Download all your current settings as a JSON file for backup purposes.
            </Text>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleExport}
              loading={isExporting}
              variant="light"
              size="sm"
            >
              Export All Settings
            </Button>
          </Stack>

          {/* Import Section */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>Import Settings</Text>
            <Text size="xs">
              Upload a previously exported settings file to restore your preferences.
            </Text>
            <FileInput
              ref={fileInputRef}
              placeholder="Choose settings file..."
              accept=".json"
              onChange={handleFileSelect}
              disabled={isImporting}
              leftSection={<IconUpload size={16} />}
              size="sm"
            />
          </Stack>

          {/* Global Reset Section */}
          <Stack gap="xs">
            <Text size="sm" fw={500}>Reset All Settings</Text>
            <Text size="xs">
              Reset all settings to their default values. This action cannot be undone.
            </Text>
            <GlobalSettingsResetButton onReset={handleGlobalReset} />
          </Stack>
        </Stack>
      </Card>

      {/* Import Validation Modal */}
      <ImportValidationModal
        isOpen={validationModal.isOpen}
        onClose={() => setValidationModal({ isOpen: false, result: null, settings: null, fileName: "" })}
        validationResult={validationModal.result}
        onConfirm={handleImportConfirm}
        fileName={validationModal.fileName}
      />
    </>
  );
}