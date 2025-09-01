/**
 * Storage Loading State Component
 *
 * Displays loading indicator for storage data operations.
 */
import React from "react";
import { Loader, Text } from "@mantine/core";

export const StorageLoadingState = () => {
  return (
    <div style={{ textAlign: "center", padding: "40px" }}>
      <Loader size="lg" />
      <Text mt="md">Loading storage information...</Text>
    </div>
  );
};