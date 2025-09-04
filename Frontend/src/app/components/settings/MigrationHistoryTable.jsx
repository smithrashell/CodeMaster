/**
 * Migration History Table Component
 */
import React from "react";
import {
  Text,
  Table,
  Badge,
  Code,
} from "@mantine/core";

export const MigrationHistoryTable = ({ migrationHistory, formatDuration }) => {
  if (migrationHistory.length === 0) {
    return (
      <Text color="dimmed" ta="center">
        No migrations found
      </Text>
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Items</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {migrationHistory.map((migration) => (
          <tr key={migration.id}>
            <td>
              <Code size="xs">{migration.id.split("_").pop()}</Code>
            </td>
            <td>
              <Badge size="sm" variant="dot">
                {migration.type}
              </Badge>
            </td>
            <td>
              <Badge
                size="sm"
                color={
                  migration.state === "completed"
                    ? "green"
                    : migration.state === "failed"
                    ? "red"
                    : "blue"
                }
              >
                {migration.state}
              </Badge>
            </td>
            <td>{formatDuration(migration.duration)}</td>
            <td>
              {migration.migratedItems || migration.restoredItems || 0}
            </td>
            <td>{new Date(migration.startTime).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};