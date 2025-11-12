import { Grid, Card, Text, Badge, Box } from "@mantine/core";

const KPI_HEIGHT = 132;

export function ProgressKPICards({
  totalProblems,
  strategySuccessRate,
  timerBehavior,
  timerPercentage,
  nextReviewTime,
  nextReviewCount
}) {
  const kpiData = [
    {
      id: 'box-distribution',
      card: (
        <Card withBorder p="lg" style={{ textAlign: 'center' }}>
          <Text size="lg" fw={600} mb="xs">Box Distribution</Text>
          <Text size="xl" fw={700} style={{ color: 'var(--cm-text)', fontSize: '1.4rem' }}>
            {totalProblems} problems
          </Text>
          <Text size="xs">across 7 boxes</Text>
        </Card>
      )
    },
    {
      id: 'strategy-success',
      card: (
        <Card withBorder p="lg" style={{ textAlign: 'center' }}>
          <Text size="lg" fw={600} mb="xs">Strategy Success</Text>
          <Text size="xl" fw={700} style={{ color: 'var(--cm-text)', fontSize: '1.4rem' }}>
            {strategySuccessRate ?? 0}%
          </Text>
          <Text size="xs">effectiveness rate</Text>
        </Card>
      )
    },
    {
      id: 'timer-behavior',
      card: (
        <Card withBorder p="lg" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Text size="lg" fw={600} mb="xs">Timer Behavior</Text>
          <Badge variant="light" color="teal" size="lg" style={{ fontSize: '0.9rem', padding: '8px 12px', marginBottom: '8px' }}>
            {timerBehavior}
          </Badge>
          <Text size="xs">{timerPercentage}% within limits</Text>
        </Card>
      )
    },
    {
      id: 'next-review',
      card: (
        <Card withBorder p="lg" style={{ textAlign: 'center' }}>
          <Text size="lg" fw={600} mb="xs">Next Review</Text>
          <Text size="md" fw={600} style={{ color: 'var(--cm-text)' }}>
            {nextReviewTime}
          </Text>
          <Text size="xs">{nextReviewCount} problems ready</Text>
        </Card>
      )
    }
  ];

  return (
    <Grid gutter="md" align="stretch">
      {kpiData.map(({ id, card }) => (
        <Grid.Col key={id} span={{ base: 12, sm: 6, lg: 3 }}>
          <Box h={KPI_HEIGHT} style={{ display: "flex", flexDirection: "column" }}>
            {card}
          </Box>
        </Grid.Col>
      ))}
    </Grid>
  );
}