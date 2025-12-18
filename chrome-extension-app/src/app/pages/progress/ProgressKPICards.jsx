import { Grid, Card, Text, Badge, Box, Group } from "@mantine/core";

const KPI_HEIGHT = 110;

// Consistent KPI card matching session-history.jsx SlimKPI pattern
function KPICard({ title, value, sub }) {
  return (
    <Card p="sm" radius="md" style={{ backgroundColor: 'var(--cm-card-bg)', border: '1px solid var(--cm-border)', textAlign: 'center', height: '100%' }}>
      <Text size="xs" mb={2}>{title}</Text>
      <Group align="baseline" gap={4} justify="center">
        <Text size="lg" fw={700}>{value}</Text>
      </Group>
      {sub && <Text size="xs" c="var(--cm-text-dimmed)">{sub}</Text>}
    </Card>
  );
}

// Badge-based KPI card for status values
function BadgeKPICard({ title, badge, badgeColor, sub }) {
  return (
    <Card p="sm" radius="md" style={{ backgroundColor: 'var(--cm-card-bg)', border: '1px solid var(--cm-border)', textAlign: 'center', height: '100%' }}>
      <Text size="xs" mb={4}>{title}</Text>
      <Group justify="center">
        <Badge variant="light" color={badgeColor} size="md">
          {badge}
        </Badge>
      </Group>
      {sub && <Text size="xs" c="var(--cm-text-dimmed)" mt={4}>{sub}</Text>}
    </Card>
  );
}

export function ProgressKPICards({
  totalProblems,
  strategySuccessRate,
  timerBehavior,
  timerPercentage,
  nextReviewTime,
  nextReviewCount
}) {
  return (
    <Grid gutter="md" align="stretch">
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <Box h={KPI_HEIGHT}>
          <KPICard
            title="Box Distribution"
            value={`${totalProblems} problems`}
            sub="across 7 boxes"
          />
        </Box>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <Box h={KPI_HEIGHT}>
          <KPICard
            title="Strategy Success"
            value={`${strategySuccessRate ?? 0}%`}
            sub="effectiveness rate"
          />
        </Box>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <Box h={KPI_HEIGHT}>
          <BadgeKPICard
            title="Timer Behavior"
            badge={timerBehavior}
            badgeColor="teal"
            sub={`${timerPercentage}% within limits`}
          />
        </Box>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <Box h={KPI_HEIGHT}>
          <KPICard
            title="Next Review"
            value={nextReviewTime}
            sub={`${nextReviewCount} problems ready`}
          />
        </Box>
      </Grid.Col>
    </Grid>
  );
}