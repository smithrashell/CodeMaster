import React from "react";
import { Text, Stack, Group, Box } from "@mantine/core";

export function HeatmapChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Stack gap="xs" align="center" style={{ height: '100%', justifyContent: 'center' }}>
        <Text size="sm" c="dimmed">No data to display</Text>
        <Text size="xs" c="dark.3">Complete more sessions to see patterns</Text>
      </Stack>
    );
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = [...Array(24)].map((_, i) => i);

  // Get max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Get cell color based on count
  const getCellColor = (count) => {
    if (count === 0) return 'var(--mantine-color-dark-7)';
    const intensity = count / maxCount;
    // Use green color with varying opacity
    return `rgba(130, 202, 157, ${0.2 + intensity * 0.8})`;
  };

  // Group data by day for easier rendering
  const dataByDay = {};
  dayNames.forEach(day => {
    dataByDay[day] = data.filter(d => d.day === day);
  });

  return (
    <Box style={{ width: '100%', height: '100%', overflowX: 'auto' }}>
      <Stack gap={4}>
        {/* Heatmap grid */}
        {dayNames.map(day => (
          <Group key={day} gap={2} wrap="nowrap">
            {/* Day label */}
            <Text size="11px" c="dimmed" style={{ width: '35px', textAlign: 'right', paddingRight: '5px' }}>
              {day}
            </Text>

            {/* Hour cells */}
            <Group gap={2} wrap="nowrap">
              {hours.map(hour => {
                const cell = dataByDay[day]?.find(d => d.hour === hour);
                const count = cell?.count || 0;

                return (
                  <Box
                    key={`${day}-${hour}`}
                    style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: getCellColor(count),
                      borderRadius: '3px',
                      border: '1px solid var(--mantine-color-dark-5)',
                      cursor: count > 0 ? 'pointer' : 'default',
                      transition: 'transform 0.1s',
                    }}
                    title={count > 0 ? `${day} ${hour}:00 - ${count} session${count > 1 ? 's' : ''}` : ''}
                    onMouseEnter={(e) => {
                      if (count > 0) e.currentTarget.style.transform = 'scale(1.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  />
                );
              })}
            </Group>
          </Group>
        ))}

        {/* Legend */}
        <Group gap="xs" justify="center" mt="sm">
          <Text size="10px" c="dimmed">Less</Text>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
            <Box
              key={i}
              style={{
                width: '14px',
                height: '14px',
                backgroundColor: intensity === 0
                  ? 'var(--mantine-color-dark-7)'
                  : `rgba(130, 202, 157, ${0.2 + intensity * 0.8})`,
                borderRadius: '2px',
                border: '1px solid var(--mantine-color-dark-5)'
              }}
            />
          ))}
          <Text size="10px" c="dimmed">More</Text>
        </Group>
      </Stack>
    </Box>
  );
}
