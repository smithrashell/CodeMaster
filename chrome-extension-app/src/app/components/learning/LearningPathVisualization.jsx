import React from 'react';
import { Card, Text, Progress, Badge, Group, Stack, Grid } from '@mantine/core';

const MAX_VISIBLE = 5;

const STATUS_COLORS = {
  mastered: { bg: 'var(--cm-chart-success)', badge: 'green', progress: 'green' },
  learning: { bg: 'var(--cm-chart-primary)', badge: 'blue', progress: 'blue' },
  available: { bg: 'var(--cm-chart-primary)', badge: 'blue', progress: 'blue' },
  'not-started': { bg: 'var(--cm-chart-secondary)', badge: 'gray', progress: 'gray' },
};

function TagCard({ tag, onClick, isSelected }) {
  const colors = STATUS_COLORS[tag.status] || STATUS_COLORS['not-started'];
  return (
    <Card
      withBorder p="xs" radius="sm"
      onClick={() => onClick?.(tag.tag)}
      style={{
        cursor: 'pointer',
        backgroundColor: 'var(--cm-card-bg)',
        borderLeft: `3px solid ${colors.bg}`,
        outline: isSelected ? '2px solid var(--cm-chart-primary)' : 'none',
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={500} truncate>{tag.tag}</Text>
        <Text size="xs" fw={600} c={colors.badge}>{tag.progress}%</Text>
      </Group>
      <Progress value={tag.progress} color={colors.progress} size="xs" mt={4} />
    </Card>
  );
}

function FlowColumn({ title, tags, badgeColor, onTagClick, selectedTag }) {
  const visible = tags.slice(0, MAX_VISIBLE);
  const overflow = tags.length - MAX_VISIBLE;
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text size="sm" fw={600}>{title}</Text>
        <Badge size="xs" color={badgeColor} variant="light">{tags.length}</Badge>
      </Group>
      {visible.map(tag => (
        <TagCard key={tag.tag} tag={tag} onClick={onTagClick} isSelected={selectedTag === tag.tag} />
      ))}
      {tags.length === 0 && (
        <Text size="xs" c="dimmed" ta="center" py="md">None yet</Text>
      )}
      {overflow > 0 && (
        <Text size="xs" c="dimmed" ta="center">+{overflow} more</Text>
      )}
    </Stack>
  );
}

export function LearningPathVisualization({ flowData, onNodeClick, selectedTag }) {
  if (!flowData) return null;
  const { columns } = flowData;

  return (
    <Grid gutter="md">
      <Grid.Col span={4}>
        <FlowColumn title="Mastered" tags={columns.mastered} badgeColor="green" onTagClick={onNodeClick} selectedTag={selectedTag} />
      </Grid.Col>
      <Grid.Col span={4}>
        <FlowColumn title="Current Focus" tags={columns.focus} badgeColor="blue" onTagClick={onNodeClick} selectedTag={selectedTag} />
      </Grid.Col>
      <Grid.Col span={4}>
        <FlowColumn title="Up Next" tags={columns.upNext} badgeColor="gray" onTagClick={onNodeClick} selectedTag={selectedTag} />
      </Grid.Col>
    </Grid>
  );
}

export default LearningPathVisualization;
