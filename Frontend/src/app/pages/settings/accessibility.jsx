import logger from "../../../shared/utils/logger.js";
import React, { useState, useEffect, useMemo } from "react";
import { Container, Title, Text, Stack, Card, Alert, Button, Group, Tooltip } from "@mantine/core";
import { IconAccessible, IconKeyboard, IconHandFinger, IconInfoCircle } from "@tabler/icons-react";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { SettingsResetButton } from "../../components/settings/SettingsResetButton.jsx";

// Settings Save Hook for Accessibility
function useAccessibilitySettingsSave(setSaveStatus, setHasChanges, setIsSaving) {
  return async (settings) => {
    if (!settings) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const currentSettings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
          resolve(response || {});
        });
      });

      const updatedSettings = {
        ...currentSettings,
        accessibility: settings
      };

      chrome.runtime.sendMessage(
        { type: "setSettings", message: updatedSettings },
        (response) => {
          chrome.runtime.sendMessage({ type: "clearSettingsCache" }, (_cacheResponse) => {
            if (chrome.runtime.lastError) {
              logger.warn("Clear cache failed:", chrome.runtime.lastError.message);
            }
          });

          if (response?.status === "success") {
            setSaveStatus({ type: "success", message: "Accessibility settings saved successfully!" });
            setHasChanges(false);
          } else {
            setSaveStatus({ type: "error", message: "Failed to save accessibility settings." });
          }
        }
      );
    } catch (error) {
      logger.error("AccessibilitySettings: Error saving settings:", error);
      setSaveStatus({ type: "error", message: "Failed to save accessibility settings." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
}

export function Accessibility() {
  const DEFAULT_ACCESSIBILITY_SETTINGS = useMemo(() => ({
    screenReader: {
      enabled: false,
      verboseDescriptions: true,
      announceNavigation: true,
      readFormLabels: true
    },
    keyboard: {
      enhancedFocus: false,
      customShortcuts: false,
      focusTrapping: false
    },
    motor: {
      largerTargets: false,
      extendedHover: false,
      reducedMotion: false,
      stickyHover: false
    }
  }), []);

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

  // Cleanup any existing accessibility classes on mount
  useEffect(() => {
    const root = document.documentElement;
    // Remove all accessibility classes initially
    root.classList.remove(
      'a11y-large-targets',
      'a11y-reduced-motion', 
      'a11y-extended-hover',
      'a11y-sticky-hover',
      'a11y-enhanced-focus'
    );
  }, []);

  // Apply CSS classes whenever settings change
  useEffect(() => {
    // Skip if settings are empty (initial load)
    if (!settings || Object.keys(settings).length === 0) return;
    
    // Apply CSS classes based on settings
    const root = document.documentElement;
    
    // Motor accessibility
    if (settings?.motor?.largerTargets) {
      root.classList.add('a11y-large-targets');
    } else {
      root.classList.remove('a11y-large-targets');
    }
    
    if (settings?.motor?.reducedMotion) {
      root.classList.add('a11y-reduced-motion');
    } else {
      root.classList.remove('a11y-reduced-motion');
    }
    
    if (settings?.motor?.extendedHover) {
      root.classList.add('a11y-extended-hover');
    } else {
      root.classList.remove('a11y-extended-hover');
    }

    if (settings?.motor?.stickyHover) {
      root.classList.add('a11y-sticky-hover');
    } else {
      root.classList.remove('a11y-sticky-hover');
    }

    // Keyboard navigation
    if (settings?.keyboard?.enhancedFocus) {
      root.classList.add('a11y-enhanced-focus');
    } else {
      root.classList.remove('a11y-enhanced-focus');
    }


  }, [settings]);

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

  const SettingToggle = ({ title, description, category, setting, value }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      padding: '20px 0',
      borderBottom: '1px solid var(--cm-border)',
      marginBottom: '4px'
    }}>
      <div style={{ flex: 1, marginRight: '20px' }}>
        <Text fw={600} size="md" style={{ color: 'var(--cm-text)', marginBottom: '6px', fontSize: '0.95rem' }}>{title}</Text>
        <Text size="sm" style={{ color: 'var(--cm-text-secondary)', opacity: 0.7, lineHeight: 1.4 }}>{description}</Text>
      </div>
      <label 
        style={{ 
          position: 'relative', 
          width: '48px', 
          height: '24px', 
          cursor: 'pointer' 
        }}
        aria-label={`Toggle ${title}`}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => handleSettingChange(category, setting, e.target.checked)}
          style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%' }}
        />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '48px',
          height: '24px',
          backgroundColor: value ? 'var(--cm-accent)' : 'var(--cm-border)',
          borderRadius: '12px',
          transition: 'background-color 0.3s ease'
        }}>
          <div style={{
            position: 'absolute',
            top: '2px',
            left: value ? '26px' : '2px',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'left 0.3s ease'
          }} />
        </div>
      </label>
    </div>
  );

  if (loading) {
    return (
      <Container size="md" p="xl">
        <Title order={1} fw={700} mb="md" style={{ fontSize: '1.75rem', color: 'var(--cm-text)' }}>Accessibility Settings</Title>
        <Text size="sm" c="dimmed">Loading accessibility settings...</Text>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="md" p="xl">
        <Title order={1} fw={700} mb="md" style={{ fontSize: '1.75rem', color: 'var(--cm-text)' }}>Accessibility Settings</Title>
        <Alert color="red" variant="light">
          Failed to load accessibility settings. Please refresh the page.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xl">
        Accessibility Settings
      </Title>

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
        {/* Screen Reader Support */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconAccessible size={20} />
              <Title order={4}>Screen Reader Support</Title>
              <Tooltip label="Enhanced compatibility with screen reading software">
                <IconInfoCircle size={16} style={{ cursor: "help" }} />
              </Tooltip>
            </div>

            <Text size="sm" c="dimmed">
              Configure screen reader optimizations for better accessibility.
            </Text>

          <SettingToggle
            title="Enable Screen Reader Optimizations"
            description="Adds ARIA labels and descriptions throughout the interface"
            category="screenReader"
            setting="enabled"
            value={settings?.screenReader?.enabled || false}
          />

          <SettingToggle
            title="Verbose Descriptions"
            description="Provides detailed descriptions of charts, graphs, and complex elements"
            category="screenReader"
            setting="verboseDescriptions"
            value={settings?.screenReader?.verboseDescriptions ?? true}
          />

          <SettingToggle
            title="Navigation Announcements"
            description="Announces page changes and navigation events"
            category="screenReader"
            setting="announceNavigation"
            value={settings?.screenReader?.announceNavigation ?? true}
          />

          <SettingToggle
            title="Form Label Reading"
            description="Ensures all form inputs have clear, readable labels"
            category="screenReader"
            setting="readFormLabels"
            value={settings?.screenReader?.readFormLabels ?? true}
          />
          </Stack>
        </Card>

        {/* Keyboard Navigation */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconKeyboard size={20} />
              <Title order={4}>Keyboard Navigation</Title>
              <Tooltip label="Improved keyboard accessibility and navigation">
                <IconInfoCircle size={16} style={{ cursor: "help" }} />
              </Tooltip>
            </div>

            <Text size="sm" c="dimmed">
              Configure keyboard navigation enhancements for better accessibility.
            </Text>

          <SettingToggle
            title="Enhanced Focus Indicators"
            description="Makes keyboard focus more visible with stronger borders and colors"
            category="keyboard"
            setting="enhancedFocus"
            value={settings?.keyboard?.enhancedFocus || false}
          />


          <SettingToggle
            title="Focus Trapping in Modals"
            description="Keeps keyboard focus within modal dialogs and popups"
            category="keyboard"
            setting="focusTrapping"
            value={settings?.keyboard?.focusTrapping || false}
          />

          <SettingToggle
            title="Custom Keyboard Shortcuts"
            description="Enables additional keyboard shortcuts for common actions"
            category="keyboard"
            setting="customShortcuts"
            value={settings?.keyboard?.customShortcuts || false}
          />
          </Stack>
        </Card>

        {/* Motor Accessibility */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconHandFinger size={20} />
              <Title order={4}>Motor Accessibility</Title>
              <Tooltip label="Features for users with motor impairments">
                <IconInfoCircle size={16} style={{ cursor: "help" }} />
              </Tooltip>
            </div>

            <Text size="sm" c="dimmed">
              Configure motor accessibility features for easier interaction.
            </Text>

          <SettingToggle
            title="Larger Click Targets"
            description="Increases the size of buttons and clickable elements"
            category="motor"
            setting="largerTargets"
            value={settings?.motor?.largerTargets || false}
          />

          <SettingToggle
            title="Extended Hover Time"
            description="Keeps hover states visible longer before they disappear"
            category="motor"
            setting="extendedHover"
            value={settings?.motor?.extendedHover || false}
          />

          <SettingToggle
            title="Reduce Motion"
            description="Minimizes animations and transitions that may cause discomfort"
            category="motor"
            setting="reducedMotion"
            value={settings?.motor?.reducedMotion || false}
          />

          <SettingToggle
            title="Sticky Hover States"
            description="Hover effects remain until explicitly dismissed"
            category="motor"
            setting="stickyHover"
            value={settings?.motor?.stickyHover || false}
          />
          </Stack>
        </Card>

        {/* Action Buttons */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <SettingsResetButton
                onReset={handleReset}
                disabled={loading || isSaving}
                settingsType="accessibility settings"
                variant="subtle"
              />
              
              <Button
                onClick={() => handleSave(settings)}
                loading={isSaving}
                disabled={!hasChanges || loading}
                size="sm"
              >
                Save Accessibility Settings
              </Button>
            </Group>
            
            <Title order={4}>Need Additional Help?</Title>
            <Text size="sm">
              If you need additional accessibility accommodations or encounter any barriers 
              while using this application, please don&apos;t hesitate to reach out for support.
            </Text>
            <Text size="xs" c="dimmed">
              These settings are saved securely and will persist across browser sessions.
              You may need to refresh the page for some changes to take full effect.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}