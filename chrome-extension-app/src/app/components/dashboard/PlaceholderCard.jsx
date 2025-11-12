import React from "react";
import { Card, Text } from "@mantine/core";

export function PlaceholderCard({ text }) {
  return (
    <Card withBorder p="sm" h="100%" style={{ 
      backgroundColor: "#f8f9fa", 
      border: "2px dashed #e0e0e0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "80px"
    }}>
      <Text size="xs" style={{ textAlign: "center" }}>
        {text}
      </Text>
    </Card>
  );
}