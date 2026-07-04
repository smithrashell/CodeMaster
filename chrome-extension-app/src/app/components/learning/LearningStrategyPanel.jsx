import { Card, Title, Text, Button, Stack, Progress, Group, Badge } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";

const DIFF_COLORS = { Easy: 'green', Medium: 'orange', Hard: 'red' };

const LearningStrategyPanel = ({ selectedTag, pathData, flowData, onTagDeselect }) => {
  return (
    <>
      <Title order={4} mb="md">
        {selectedTag ? selectedTag : 'Learning Intelligence'}
      </Title>
      <Stack gap="md">
        {selectedTag ? (
          <SelectedTagStrategy selectedTag={selectedTag} pathData={pathData} flowData={flowData} onTagDeselect={onTagDeselect} />
        ) : (
          <OverviewStrategy pathData={pathData} flowData={flowData} />
        )}
      </Stack>
    </>
  );
};

const GateRow = ({ label, passed, current, required }) => (
  <Group gap="xs" mb={4} wrap="nowrap">
    {passed
      ? <IconCheck size={14} color="var(--cm-chart-success)" />
      : <IconX size={14} color="var(--cm-status-hard)" />}
    <Text size="xs" style={{ flex: 1 }}>{label}</Text>
    <Text size="xs" c="dimmed" fw={500}>{current}/{required}</Text>
  </Group>
);

const SelectedTagStrategy = ({ selectedTag, pathData, flowData, onTagDeselect }) => {
  const tagData = pathData.find(t => t.tag === selectedTag);
  const meta = flowData?.tagMeta?.[selectedTag];
  const tierProgress = flowData?.tierProgress;
  const allTierTags = flowData?.columns
    ? [...flowData.columns.mastered, ...flowData.columns.focus, ...flowData.columns.upNext]
    : [];

  const totalAttempts = tagData?.total_attempts ?? 0;
  const minAttempts = meta?.min_attempts_required ?? 8;
  const threshold = meta?.mastery_threshold ?? 0.80;
  const thresholdPct = Math.round(threshold * 100);
  const uniqueProblems = tagData?.attempted_problem_ids?.length ?? 0;
  const minUnique = Math.ceil(minAttempts * 0.7);
  const recentResults = tagData?.recent_results;
  const accuracy = Array.isArray(recentResults) && recentResults.length > 0
    ? Math.round((recentResults.filter(Boolean).length / recentResults.length) * 100)
    : tagData?.progress ?? 0;
  const ladder = meta?.ladderCoverage || { attempted: 0, total: 0, percentage: 0 };
  const ladderPct = Math.round(ladder.percentage * 100);
  const ladderCompleted = ladder.total > 0 && uniqueProblems >= ladder.total;
  const ladderPassed = ladderPct >= 70 || ladderCompleted;

  const gates = [
    { label: 'Volume', passed: totalAttempts >= minAttempts, current: totalAttempts, required: minAttempts },
    { label: 'Unique Problems', passed: uniqueProblems >= minUnique, current: uniqueProblems, required: minUnique },
    { label: 'Accuracy', passed: accuracy >= thresholdPct, current: `${accuracy}%`, required: `${thresholdPct}%` },
    { label: 'Ladder Progress', passed: ladderPassed, current: `${ladder.attempted}/${ladder.total}`, required: '70%' }
  ];
  const passedCount = gates.filter(g => g.passed).length;

  const dist = meta?.difficulty_distribution || {};
  const distTotal = (dist.easy || 0) + (dist.medium || 0) + (dist.hard || 0);

  const tierTagNames = new Set(allTierTags.map(t => t.tag));
  const relatedInTier = (meta?.related_tags || [])
    .filter(r => tierTagNames.has(r.tag) && r.tag !== selectedTag)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);

  const masteredAfter = (tierProgress?.mastered || 0) + (tagData?.mastered ? 0 : 1);

  return (
    <>
      <Card p="sm" withBorder radius="md" style={{ backgroundColor: 'var(--cm-card-bg)' }}>
        <Group justify="space-between" mb={6}>
          <Text size="xs" c="dimmed">Mastery Gates</Text>
          <Badge size="xs" variant="light" color={passedCount === 4 ? 'green' : 'blue'}>
            {passedCount}/4
          </Badge>
        </Group>
        {gates.map(g => <GateRow key={g.label} {...g} />)}
      </Card>

      {distTotal > 0 && (
        <Card p="sm" withBorder radius="md" style={{ backgroundColor: 'var(--cm-card-bg)' }}>
          <Text size="xs" c="dimmed" mb={6}>Difficulty Breakdown</Text>
          {['easy', 'medium', 'hard'].map(d => {
            const count = dist[d] || 0;
            const pct = Math.round((count / distTotal) * 100);
            const label = d.charAt(0).toUpperCase() + d.slice(1);
            return (
              <Group key={d} gap="xs" mb={4} wrap="nowrap">
                <Text size="xs" w={50}>{label}</Text>
                <Progress value={pct} color={DIFF_COLORS[label]} size="xs" style={{ flex: 1 }} />
                <Text size="xs" c="dimmed" w={30} ta="right">{count}</Text>
              </Group>
            );
          })}
        </Card>
      )}

      {relatedInTier.length > 0 && (
        <Card p="sm" withBorder radius="md" style={{ backgroundColor: 'var(--cm-card-bg)' }}>
          <Text size="xs" c="dimmed" mb={6}>Related Tags (in tier)</Text>
          {relatedInTier.map(r => (
            <Group key={r.tag} justify="space-between" mb={2}>
              <Text size="xs">{r.tag}</Text>
              <Badge size="xs" variant="light" color="blue">{r.strength.toFixed(2)}</Badge>
            </Group>
          ))}
        </Card>
      )}

      <Card p="sm" withBorder radius="md" style={{ backgroundColor: 'var(--cm-accent-bg)' }}>
        <Text size="xs" c="dimmed">Tier Impact</Text>
        <Text size="sm" fw={500}>
          {tagData?.mastered
            ? 'Already mastered'
            : `Mastering → ${masteredAfter}/${tierProgress?.total || '?'} toward next tier`}
        </Text>
      </Card>

      <Button variant="light" size="sm" fullWidth onClick={onTagDeselect}>Back to Overview</Button>
    </>
  );
};

const OverviewStrategy = ({ pathData, flowData }) => {
  const focusCount = pathData.filter(t => t.isFocus).length;
  const tierProgress = flowData?.tierProgress;

  return (
    <>
      <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--cm-card-bg)" }}>
        <Text size="sm" fw={600} mb="xs">Active Learning Strategy</Text>
        <Text size="xs">
          Focus on {focusCount} core {focusCount === 1 ? 'area' : 'areas'} to maximize learning efficiency
        </Text>
      </Card>

      {tierProgress && (
        <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--cm-card-bg)" }}>
          <Text size="sm" fw={600} mb="xs">Tier Progress</Text>
          <Text size="xs">
            {tierProgress.mastered}/{tierProgress.total} tags mastered ({tierProgress.percentage}%)
          </Text>
          <Progress value={tierProgress.percentage} color="blue" size="sm" mt={6} />
        </Card>
      )}

      <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--cm-card-bg)" }}>
        <Text size="sm" fw={600} mb="xs">How It Works</Text>
        <Text size="xs">Click a tag to see mastery requirements, difficulty breakdown, and tier impact.</Text>
      </Card>
    </>
  );
};

export default LearningStrategyPanel;
