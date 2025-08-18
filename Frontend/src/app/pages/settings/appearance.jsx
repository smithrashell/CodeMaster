import React from "react";
import { Container, Title, Grid, Card, Text } from "@mantine/core";
import ThemeToggle from "../../../shared/components/ThemeToggle.jsx";
import {
  FontSizeSelector,
  LayoutDensitySelector,
  AnimationToggle,
} from "../../../shared/components/AppearanceControls.jsx";

export function Appearance() {
  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xl" style={{ color: "var(--cm-text)" }}>
        Appearance Settings
      </Title>

      <Grid gutter="lg">
        {/* Theme Selection */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Theme
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Choose between light and dark themes. Changes will sync across the
              content page and dashboard.
            </Text>
            <ThemeToggle />
          </Card>
        </Grid.Col>

        {/* Font Size Settings */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Font Size
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Adjust the text size for better readability.
            </Text>
            <FontSizeSelector />
          </Card>
        </Grid.Col>

        {/* Layout Density */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Layout Density
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Choose between compact or comfortable spacing for interface
              elements.
            </Text>
            <LayoutDensitySelector />
          </Card>
        </Grid.Col>

        {/* Animation Preferences */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Animations
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Enable or disable animations and transitions for better
              performance.
            </Text>
            <AnimationToggle />
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}