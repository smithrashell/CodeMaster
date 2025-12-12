import React from "react";
import { Card, Text } from "@mantine/core";

export function PlaceholderCard({ text }) {
  return (
    <Card withBorder p="sm" h="100%" style={{
      backgroundColor: "var(--cm-bg-secondary)",
      border: "2px dashed var(--cm-border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "80px"
    }}>
      <Text size="xs" c="dimmed" style={{ textAlign: "center" }}>
        {text}
      </Text>
    </Card>
  );
}