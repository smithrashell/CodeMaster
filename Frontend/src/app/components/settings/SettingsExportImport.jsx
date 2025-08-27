import React, { useState, useRef } from "react";
import { Card, Text, Title, Stack, Button, Group, Alert, FileInput, Modal } from "@mantine/core";
import { IconDownload, IconUpload, IconFileCode, IconInfoCircle, IconCheck, IconX } from "@tabler/icons-react";
import { GlobalSettingsResetButton } from "./SettingsResetButton.jsx";

// Settings validation schema
const SETTINGS_SCHEMA = {
  // Core session settings
  adaptive: "boolean",
  sessionLength: "number",
  numberofNewProblemsPerSession: "number", 
  limit: "string",
  reminder: "object",
  
  // Interview settings
  interviewMode: "string",
  interviewReadinessThreshold: "number",
  interviewFrequency: "string",
  
  // Focus areas
  focusAreas: "object",
  
  // Timer settings
  timerDisplay: "string",
  breakReminders: "object",
  notifications: "object",
  
  // Display settings
  display: "object",
  
  // Theme settings
  theme: "string"
};

// Validate imported settings
function validateSettings(settings) {
  const errors = [];
  const warnings = [];
  
  if (typeof settings !== "object" || settings === null) {
    errors.push("Settings must be a valid JSON object");
    return { isValid: false, errors, warnings };
  }
  
  // Check for required fields
  if (!Object.prototype.hasOwnProperty.call(settings, "adaptive")) {
    warnings.push("Missing adaptive session setting, using default");
  }
  
  // Validate data types
  Object.entries(SETTINGS_SCHEMA).forEach(([key, expectedType]) => {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      const actualType = Array.isArray(settings[key]) ? "array" : typeof settings[key];
      if (expectedType === "object" && actualType !== "object") {
        errors.push(`${key} should be an object, got ${actualType}`);
      } else if (expectedType !== "object" && expectedType !== actualType) {
        warnings.push(`${key} should be ${expectedType}, got ${actualType} - will use default`);
      }
    }
  });
  
  // Validate interview mode specific values
  if (Object.prototype.hasOwnProperty.call(settings, "interviewMode")) {
    const validModes = ["disabled", "interview-like", "full-interview"];
    if (!validModes.includes(settings.interviewMode)) {
      errors.push(`Interview mode must be one of: ${validModes.join(", ")}`);
    }
  }
  
  if (Object.prototype.hasOwnProperty.call(settings, "interviewReadinessThreshold")) {
    const threshold = settings.interviewReadinessThreshold;
    if (typeof threshold === "number" && (threshold < 0 || threshold > 1)) {
      warnings.push("Interview readiness threshold should be between 0 and 1");
    }
  }
  
  if (Object.prototype.hasOwnProperty.call(settings, "interviewFrequency")) {
    const validFrequencies = ["manual", "weekly", "after-mastery"];
    if (!validFrequencies.includes(settings.interviewFrequency)) {
      warnings.push(`Interview frequency should be one of: ${validFrequencies.join(", ")}`);
    }
  }
  
  // Check for suspicious properties that might indicate malicious content
  const suspiciousKeys = ["script", "eval", "function", "__proto__", "constructor", "prototype"];
  const checkSuspiciousContent = (obj, path = "") => {
    Object.keys(obj).forEach(key => {
      if (suspiciousKeys.includes(key.toLowerCase())) {
        errors.push(`Suspicious property detected: ${path}${key}`);
      }
      if (typeof obj[key] === "object" && obj[key] !== null) {
        checkSuspiciousContent(obj[key], `${path}${key}.`);
      }
    });
  };
  checkSuspiciousContent(settings);
  
  const isValid = errors.length === 0;
  return { isValid, errors, warnings };
}

// Import validation modal component
function ImportValidationModal({ 
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

export function SettingsExportImport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [validationModal, setValidationModal] = useState({ 
    isOpen: false, 
    result: null, 
    settings: null, 
    fileName: "" 
  });
  const fileInputRef = useRef();

  // Export all settings
  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus(null);
    
    try {
      // Get all settings from Chrome storage
      const allSettings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
          resolve(response || {});
        });
      });
      
      // Create export object with metadata
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          source: "CodeMaster Settings"
        },
        settings: allSettings
      };
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: "application/json" 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `codemaster-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportStatus({ type: "success", message: "Settings exported successfully!" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Export error:", error);
      setExportStatus({ type: "error", message: "Failed to export settings." });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  // Handle file selection for import
  const handleFileSelect = (file) => {
    if (!file) return;
    
    setIsImporting(true);
    setImportStatus(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = JSON.parse(e.target.result);
        const settings = fileContent.settings || fileContent; // Handle both new and old formats
        
        const validationResult = validateSettings(settings);
        
        setValidationModal({
          isOpen: true,
          result: validationResult,
          settings: settings,
          fileName: file.name
        });
        
      } catch (error) {
        setImportStatus({ 
          type: "error", 
          message: "Invalid JSON file. Please check the file format." 
        });
        setTimeout(() => setImportStatus(null), 3000);
      } finally {
        setIsImporting(false);
      }
    };
    
    reader.readAsText(file);
  };

  // Confirm and perform import
  const handleImportConfirm = async () => {
    try {
      const { settings } = validationModal;
      
      // Save imported settings
      chrome.runtime.sendMessage(
        { type: "setSettings", message: settings },
        (response) => {
          chrome.runtime.sendMessage({ type: "clearSettingsCache" }, (response) => {
            // Check for errors to prevent "Unchecked runtime.lastError"
            if (chrome.runtime.lastError) {
              console.warn("Clear cache failed:", chrome.runtime.lastError.message);
            }
          });
          
          if (response?.status === "success") {
            setImportStatus({ 
              type: "success", 
              message: "Settings imported successfully! Please refresh to see changes." 
            });
          } else {
            setImportStatus({ 
              type: "error", 
              message: "Failed to save imported settings." 
            });
          }
        }
      );
      
      setValidationModal({ isOpen: false, result: null, settings: null, fileName: "" });
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Import error:", error);
      setImportStatus({ type: "error", message: "Failed to import settings." });
    }
    
    setTimeout(() => setImportStatus(null), 5000);
  };

  // Global reset handler
  const handleGlobalReset = async () => {
    try {
      const defaultSettings = {
        adaptive: true,
        sessionLength: 5,
        numberofNewProblemsPerSession: 2,
        limit: "off",
        reminder: { value: false, label: "6" },
        theme: "light",
        focusAreas: [],
        timerDisplay: "mm:ss",
        breakReminders: { enabled: false, interval: 25 },
        notifications: { sound: false, browser: false, visual: true },
        display: {
          sidebarWidth: "normal",
          cardSpacing: "comfortable",
          autoCollapseSidebar: true,
          chartStyle: "modern",
          chartColorScheme: "blue",
          chartAnimations: true,
          showGridLines: true,
          showChartLegends: true,
          defaultTimeRange: "30d",
          maxDataPoints: 50,
          autoRefreshData: true,
          showEmptyDataPoints: false
        },
        interviewMode: "disabled",
        interviewReadinessThreshold: 0.8,
        interviewFrequency: "manual"
      };
      
      chrome.runtime.sendMessage(
        { type: "setSettings", message: defaultSettings },
        (response) => {
          chrome.runtime.sendMessage({ type: "clearSettingsCache" }, (response) => {
            // Check for errors to prevent "Unchecked runtime.lastError"
            if (chrome.runtime.lastError) {
              console.warn("Clear cache failed:", chrome.runtime.lastError.message);
            }
          });
          
          if (response?.status === "success") {
            setImportStatus({ 
              type: "success", 
              message: "All settings reset to defaults! Please refresh to see changes." 
            });
          }
        }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Global reset error:", error);
      setImportStatus({ type: "error", message: "Failed to reset settings." });
    }
    
    setTimeout(() => setImportStatus(null), 5000);
  };

  return (
    <>
      <Card withBorder p="lg" radius="md">
        <Stack gap="md">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconFileCode size={20} />
            <Title order={4}>Settings Management</Title>
          </div>

          <Text size="sm" c="dimmed">
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
            <Text size="xs" c="dimmed">
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
            <Text size="xs" c="dimmed">
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
            <Text size="xs" c="dimmed">
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