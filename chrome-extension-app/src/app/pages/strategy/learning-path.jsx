import React, { useState } from "react";
import { Container, Grid, Card, Title, Text, Group, Button, Badge } from "@mantine/core";
import { IconRefresh, IconCheck, IconLock } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import { useLearningPathData } from "../../hooks/useLearningPathData.js";
import LearningPathVisualization from "../../components/learning/LearningPathVisualization.jsx";
import EmptyLearningPathState from "../../components/learning/EmptyLearningPathState.jsx";
import LearningStrategyPanel from "../../components/learning/LearningStrategyPanel.jsx";
import CurrentFocusAreas from "../../components/learning/CurrentFocusAreas.jsx";
import MasteryStatus from "../../components/learning/MasteryStatus.jsx";
import LearningEfficiencyAnalytics from "../../components/learning/LearningEfficiencyAnalytics.jsx";

function TierBadge({ tier }) {
  if (tier.isCompleted) return <Badge color="green" variant="filled" leftSection={<IconCheck size={12} />}>{tier.label}</Badge>;
  if (tier.isLocked) return <Badge color="gray" variant="light" leftSection={<IconLock size={12} />}>{tier.label}</Badge>;
  return <Badge color="blue" variant="filled" size="lg">{tier.label}</Badge>;
}

function TierProgressBar({ flowData }) {
  const { tiers, tierProgress } = flowData;
  return (
    <Group gap="xs" mb="md">
      {tiers.map((tier, i) => (
        <React.Fragment key={tier.name}>
          <TierBadge tier={tier} />
          {i < tiers.length - 1 && <Text c="dimmed" size="lg">&rarr;</Text>}
        </React.Fragment>
      ))}
      <Text size="sm" c="dimmed" ml="auto">
        {tierProgress.mastered}/{tierProgress.total} mastered ({tierProgress.percentage}%)
      </Text>
    </Group>
  );
}

export function LearningPath() {
  const { data: appState, loading, error, refresh } = usePageData('learning-path');
  const flowData = useLearningPathData(appState);
  const [selectedTag, setSelectedTag] = useState(null);

  const pathData = flowData ? [...flowData.columns.mastered, ...flowData.columns.focus, ...flowData.columns.upNext] : [];

  if (loading) return <Container size="xl" p="md"><Text>Loading learning path data...</Text></Container>;
  if (error) return (
    <Container size="xl" p="md">
      <Text c="red">Error loading learning path data: {error.message}</Text>
      <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">Retry</Button>
    </Container>
  );

  return (
    <Container size="xl" p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Learning Path</Title>
        <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={refresh} size="sm">Refresh</Button>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={8}>
          <Card withBorder p="lg">
            {!flowData || pathData.length === 0 ? (
              <EmptyLearningPathState />
            ) : (
              <>
                <TierProgressBar flowData={flowData} />
                <LearningPathVisualization flowData={flowData} onNodeClick={setSelectedTag} selectedTag={selectedTag} />
              </>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={4}>
          <Card withBorder p="lg" h="100%" style={{ backgroundColor: 'var(--cm-bg-secondary)' }}>
            <LearningStrategyPanel selectedTag={selectedTag} pathData={pathData} flowData={flowData} onTagDeselect={() => setSelectedTag(null)} />
          </Card>
        </Grid.Col>

        <Grid.Col span={6}>
          <CurrentFocusAreas pathData={pathData} />
        </Grid.Col>
        <Grid.Col span={6}>
          <MasteryStatus pathData={pathData} />
        </Grid.Col>
        <Grid.Col span={12}>
          <LearningEfficiencyAnalytics />
        </Grid.Col>
      </Grid>
    </Container>
  );
}
