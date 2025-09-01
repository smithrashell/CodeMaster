import React from "react";
import { Stack, Card, Title, Text, Tooltip } from "@mantine/core";
import { IconAccessible, IconKeyboard, IconHandFinger, IconInfoCircle } from "@tabler/icons-react";
import { SettingToggle } from "./SettingToggle.jsx";

const iconMap = {
  IconAccessible,
  IconKeyboard,
  IconHandFinger
};

export function AccessibilitySection({ 
  sectionKey, 
  section, 
  settings, 
  onSettingChange 
}) {
  const IconComponent = iconMap[section.icon];

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {IconComponent && <IconComponent size={20} />}
          <Title order={4}>{section.title}</Title>
          <Tooltip label={section.tooltip}>
            <IconInfoCircle size={16} style={{ cursor: "help" }} />
          </Tooltip>
        </div>

        <Text size="sm" c="dimmed">
          {section.description}
        </Text>

        {section.settings.map((setting) => (
          <SettingToggle
            key={setting.key}
            title={setting.title}
            description={setting.description}
            category={sectionKey}
            setting={setting.key}
            value={settings?.[sectionKey]?.[setting.key] ?? (setting.defaultValue || false)}
            onChange={onSettingChange}
          />
        ))}
      </Stack>
    </Card>
  );
}