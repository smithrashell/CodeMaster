import React from "react";
import { Container, Title, Text, Alert } from "@mantine/core";

export function AccessibilityLoadingState() {
  return (
    <Container size="md" p="xl">
      <Title order={1} fw={700} mb="md" style={{ fontSize: '1.75rem', color: 'var(--cm-text)' }}>
        Accessibility Settings
      </Title>
      <Text size="sm">Loading accessibility settings...</Text>
    </Container>
  );
}

export function AccessibilityErrorState() {
  return (
    <Container size="md" p="xl">
      <Title order={1} fw={700} mb="md" style={{ fontSize: '1.75rem', color: 'var(--cm-text)' }}>
        Accessibility Settings
      </Title>
      <Alert color="red" variant="light">
        Failed to load accessibility settings. Please refresh the page.
      </Alert>
    </Container>
  );
}