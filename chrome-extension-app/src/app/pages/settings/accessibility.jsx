import React, { useState } from "react";
import { Container, Title, Stack, Alert } from "@mantine/core";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { AccessibilitySection } from "../../components/settings/AccessibilitySection.jsx";
import { AccessibilityActionButtons } from "../../components/settings/AccessibilityActionButtons.jsx";
import { AccessibilityLoadingState, AccessibilityErrorState } from "../../components/settings/AccessibilityLoadingStates.jsx";
import { useAccessibilitySettingsSave, useAccessibilityClasses } from "../../hooks/useAccessibilitySettings.js";
import { DEFAULT_ACCESSIBILITY_SETTINGS, ACCESSIBILITY_SECTIONS } from "../../config/accessibilityDefaults.js";

export function Accessibility() {
  const [settings, setSettings] = useState(DEFAULT_ACCESSIBILITY_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Load settings using Chrome message hook
  const {
    data: _chromeSettings,
    loading,
    error,
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response?.accessibility) {
        setSettings({ ...DEFAULT_ACCESSIBILITY_SETTINGS, ...response.accessibility });
      } else {
        setSettings(DEFAULT_ACCESSIBILITY_SETTINGS);
      }
    },
  });

  // Use accessibility settings save hook
  const handleSave = useAccessibilitySettingsSave(setSaveStatus, setHasChanges, setIsSaving);

  // Apply CSS classes based on settings
  useAccessibilityClasses(settings);

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev?.[category],
        [setting]: value
      }
    }));
    setHasChanges(true);
    setSaveStatus(null);
  };

  // Reset accessibility settings to defaults
  const handleReset = () => {
    setSettings(DEFAULT_ACCESSIBILITY_SETTINGS);
    setHasChanges(true);
    setSaveStatus({ type: "success", message: "Accessibility settings reset to defaults!" });
    
    // Auto-save after reset
    setTimeout(() => {
      handleSave(DEFAULT_ACCESSIBILITY_SETTINGS);
    }, 500);
  };

  if (loading) return <AccessibilityLoadingState />;
  if (error) return <AccessibilityErrorState />;

  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xl">Accessibility Settings</Title>

      {/* Save Status */}
      {saveStatus && (
        <Alert 
          color={saveStatus.type === "success" ? "green" : "red"} 
          variant="light"
          mb="lg"
        >
          {saveStatus.message}
        </Alert>
      )}

      <Stack gap="lg">
        {Object.entries(ACCESSIBILITY_SECTIONS).map(([sectionKey, section]) => (
          <AccessibilitySection
            key={sectionKey}
            sectionKey={sectionKey}
            section={section}
            settings={settings}
            onSettingChange={handleSettingChange}
          />
        ))}

        <AccessibilityActionButtons
          handleReset={handleReset}
          handleSave={handleSave}
          settings={settings}
          loading={loading}
          isSaving={isSaving}
          hasChanges={hasChanges}
        />
      </Stack>
    </Container>
  );
}