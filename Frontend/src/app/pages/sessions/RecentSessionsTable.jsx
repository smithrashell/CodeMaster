/**
 * Recent Sessions Table Component
 * 
 * Displays a table of the most recent user sessions with status and metrics
 */
import React from "react";
import { Card, Title, Text, ScrollArea, Group, Badge } from "@mantine/core";

export const RecentSessionsTable = ({ recentSessions }) => {
  return (
    <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
      <Group justify="space-between" align="center" mb="sm">
        <Title order={4} c="white">Recent Sessions</Title>
        <Badge variant="light" color="gray" size="sm">Last 10 sessions</Badge>
      </Group>
      <ScrollArea>
        <table className="cm-table">
          <thead className="cm-table-header">
            <tr>
              <th className="cm-table-th">Date</th>
              <th className="cm-table-th">Duration</th>
              <th className="cm-table-th">Problems</th>
              <th className="cm-table-th">Accuracy</th>
              <th className="cm-table-th">Status</th>
            </tr>
          </thead>
          <tbody className="cm-table-body">
            {recentSessions.map((session, index) => {
              const hasAttempts = session.attempts && session.attempts.length > 0;
              const isCompleted = (session.status === "completed" || session.completed === true) && hasAttempts;
              const sessionDate = session.Date || session.date || Date.now();
              
              return (
                <tr key={session.sessionId || session.id || index} className="cm-table-row">
                  <td className="cm-table-td cm-table-primary">{new Date(sessionDate).toLocaleDateString()}</td>
                  <td className="cm-table-td cm-table-primary">
                    {isCompleted ? (session.duration || 'N/A') + ' min' : 'Ongoing'}
                  </td>
                  <td className="cm-table-td cm-table-primary">{session.problems?.length || 0}</td>
                  <td className="cm-table-td cm-table-primary">
                    {isCompleted ? `${Math.round((session.accuracy || 0) * 100)}%` : '—'}
                  </td>
                  <td className="cm-table-td cm-table-secondary">
                    <span className={`cm-table-status ${isCompleted ? 'completed' : 'in-progress'}`}>
                      {isCompleted ? "Completed" : "In Progress"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {recentSessions.length === 0 && (
              <tr className="cm-table-row">
                <td colSpan={5} className="cm-table-td cm-table-empty">
                  <Text c="dimmed">No recent sessions found. Start practicing to see your session history!</Text>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </Card>
  );
};

export default RecentSessionsTable;