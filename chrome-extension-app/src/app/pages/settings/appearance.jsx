import React from "react";
import { Container, Title, Card, Text, Stack } from "@mantine/core";
import ThemeToggle from "../../../shared/components/ThemeToggle.jsx";
import {
  FontSizeSelector,
  LayoutDensitySelector,
  AnimationToggle,
} from "../../../shared/components/AppearanceControls.jsx";
// TODO: Re-enable for future release
// import { DisplaySettingsCard } from "../../components/settings/DisplaySettingsCard.jsx";

export function Appearance() {
  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xl">
        Appearance Settings
      </Title>

      <Stack gap="lg">
        {/* Theme Selection */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <div>
              <Text fw={500} size="lg" mb="xs">
                Theme
              </Text>
              <Text size="sm">
                Choose between light and dark themes. Changes will sync across the
                content page and dashboard.
              </Text>
            </div>
            <ThemeToggle />
          </Stack>
        </Card>

        {/* Font Size Settings */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <div>
              <Text fw={500} size="lg" mb="xs">
                Font Size
              </Text>
              <Text size="sm">
                Adjust the text size for better readability.
              </Text>
            </div>
            <FontSizeSelector />
          </Stack>
        </Card>

        {/* Layout Density */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <div>
              <Text fw={500} size="lg" mb="xs">
                Layout Density
              </Text>
              <Text size="sm">
                Choose between compact or comfortable spacing for interface
                elements.
              </Text>
            </div>
            <LayoutDensitySelector />
          </Stack>
        </Card>

        {/* Animation Preferences */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <div>
              <Text fw={500} size="lg" mb="xs">
                Animations
              </Text>
              <Text size="sm">
                Enable or disable animations and transitions for better
                performance.
              </Text>
            </div>
            <AnimationToggle />
          </Stack>
        </Card>

        {/* TODO: Re-enable Display Settings for future release */}
        {/* <DisplaySettingsCard /> */}
      </Stack>
    </Container>
  );
}