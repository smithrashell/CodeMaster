import React, { useState, useEffect } from "react";
import { Container, Title, Text, Stack, Card } from "@mantine/core";

export function Accessibility() {
  const [settings, setSettings] = useState({
    screenReader: {
      enabled: false,
      verboseDescriptions: true,
      announceNavigation: true,
      readFormLabels: true
    },
    keyboard: {
      enhancedFocus: true,
      skipToContent: true,
      customShortcuts: false,
      focusTrapping: true
    },
    motor: {
      largerTargets: false,
      extendedHover: false,
      reducedMotion: false,
      stickyHover: false
    }
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibilitySettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
    
    // Apply CSS classes based on settings
    const root = document.documentElement;
    
    // Motor accessibility
    if (settings.motor.largerTargets) {
      root.classList.add('a11y-large-targets');
    } else {
      root.classList.remove('a11y-large-targets');
    }
    
    if (settings.motor.reducedMotion) {
      root.classList.add('a11y-reduced-motion');
    } else {
      root.classList.remove('a11y-reduced-motion');
    }
    
    if (settings.motor.extendedHover) {
      root.classList.add('a11y-extended-hover');
    } else {
      root.classList.remove('a11y-extended-hover');
    }

    // Keyboard navigation
    if (settings.keyboard.enhancedFocus) {
      root.classList.add('a11y-enhanced-focus');
    } else {
      root.classList.remove('a11y-enhanced-focus');
    }

  }, [settings]);

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
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
      <label style={{ 
        position: 'relative', 
        width: '48px', 
        height: '24px', 
        cursor: 'pointer' 
      }}>
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

  return (
    <Container size="md" p="xl">
      <Title order={1} fw={700} mb="md" style={{ fontSize: '1.75rem', color: 'var(--cm-text)' }}>Accessibility Settings</Title>
      <Text size="md" mb="xl" style={{ color: 'var(--cm-text-secondary)', opacity: 0.8, lineHeight: 1.5 }}>
        Configure accessibility features to improve your experience with the application
      </Text>

      <Stack spacing="xl">
        {/* Screen Reader Support */}
        <Card withBorder p="lg" radius="md">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', padding: '8px 0', borderBottom: '2px solid var(--cm-border)', backgroundColor: 'var(--cm-card-bg)' }}>
            <Text size="xl" mr="md">🔊</Text>
            <div>
              <Title order={3} fw={600} style={{ fontSize: '1.2rem', marginBottom: '4px', color: 'var(--cm-text)' }}>Screen Reader Support</Title>
              <Text size="sm" style={{ color: 'var(--cm-text-secondary)', opacity: 0.8 }}>Enhanced compatibility with screen reading software</Text>
            </div>
          </div>

          <SettingToggle
            title="Enable Screen Reader Optimizations"
            description="Adds ARIA labels and descriptions throughout the interface"
            category="screenReader"
            setting="enabled"
            value={settings.screenReader.enabled}
          />

          <SettingToggle
            title="Verbose Descriptions"
            description="Provides detailed descriptions of charts, graphs, and complex elements"
            category="screenReader"
            setting="verboseDescriptions"
            value={settings.screenReader.verboseDescriptions}
          />

          <SettingToggle
            title="Navigation Announcements"
            description="Announces page changes and navigation events"
            category="screenReader"
            setting="announceNavigation"
            value={settings.screenReader.announceNavigation}
          />

          <SettingToggle
            title="Form Label Reading"
            description="Ensures all form inputs have clear, readable labels"
            category="screenReader"
            setting="readFormLabels"
            value={settings.screenReader.readFormLabels}
          />
        </Card>

        {/* Keyboard Navigation */}
        <Card withBorder p="lg" radius="md">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', padding: '8px 0', borderBottom: '2px solid var(--cm-border)', backgroundColor: 'var(--cm-card-bg)' }}>
            <Text size="xl" mr="md">⌨️</Text>
            <div>
              <Title order={3} fw={600} style={{ fontSize: '1.2rem', marginBottom: '4px', color: 'var(--cm-text)' }}>Keyboard Navigation</Title>
              <Text size="sm" style={{ color: 'var(--cm-text-secondary)', opacity: 0.8 }}>Improved keyboard accessibility and navigation</Text>
            </div>
          </div>

          <SettingToggle
            title="Enhanced Focus Indicators"
            description="Makes keyboard focus more visible with stronger borders and colors"
            category="keyboard"
            setting="enhancedFocus"
            value={settings.keyboard.enhancedFocus}
          />

          <SettingToggle
            title="Skip to Content Link"
            description="Adds a 'Skip to main content' link for faster navigation"
            category="keyboard"
            setting="skipToContent"
            value={settings.keyboard.skipToContent}
          />

          <SettingToggle
            title="Focus Trapping in Modals"
            description="Keeps keyboard focus within modal dialogs and popups"
            category="keyboard"
            setting="focusTrapping"
            value={settings.keyboard.focusTrapping}
          />

          <SettingToggle
            title="Custom Keyboard Shortcuts"
            description="Enables additional keyboard shortcuts for common actions"
            category="keyboard"
            setting="customShortcuts"
            value={settings.keyboard.customShortcuts}
          />
        </Card>

        {/* Motor Accessibility */}
        <Card withBorder p="lg" radius="md">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', padding: '8px 0', borderBottom: '2px solid var(--cm-border)', backgroundColor: 'var(--cm-card-bg)' }}>
            <Text size="xl" mr="md">🖱️</Text>
            <div>
              <Title order={3} fw={600} style={{ fontSize: '1.2rem', marginBottom: '4px', color: 'var(--cm-text)' }}>Motor Accessibility</Title>
              <Text size="sm" style={{ color: 'var(--cm-text-secondary)', opacity: 0.8 }}>Features for users with motor impairments</Text>
            </div>
          </div>

          <SettingToggle
            title="Larger Click Targets"
            description="Increases the size of buttons and clickable elements"
            category="motor"
            setting="largerTargets"
            value={settings.motor.largerTargets}
          />

          <SettingToggle
            title="Extended Hover Time"
            description="Keeps hover states visible longer before they disappear"
            category="motor"
            setting="extendedHover"
            value={settings.motor.extendedHover}
          />

          <SettingToggle
            title="Reduce Motion"
            description="Minimizes animations and transitions that may cause discomfort"
            category="motor"
            setting="reducedMotion"
            value={settings.motor.reducedMotion}
          />

          <SettingToggle
            title="Sticky Hover States"
            description="Hover effects remain until explicitly dismissed"
            category="motor"
            setting="stickyHover"
            value={settings.motor.stickyHover}
          />
        </Card>

        {/* Help Section */}
        <Card withBorder p="lg" radius="md" style={{ backgroundColor: 'var(--cm-card-bg)', color: 'var(--cm-text)' }}>
          <Title order={4} mb="md">Need Additional Help?</Title>
          <Text size="sm" mb="md">
            If you need additional accessibility accommodations or encounter any barriers 
            while using this application, please don't hesitate to reach out for support.
          </Text>
          <Text size="xs" c="dimmed">
            These settings are saved locally and will persist across browser sessions.
            You may need to refresh the page for some changes to take full effect.
          </Text>
        </Card>
      </Stack>
    </Container>
  );
}