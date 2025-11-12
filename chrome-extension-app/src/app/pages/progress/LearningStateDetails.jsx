import { Grid, Card, Title, SimpleGrid, Text, Badge, Group } from "@mantine/core";

function getLearningStatusColor(status) {
  switch (status) {
    case "Active Learning": return "green";
    case "Intermittent Learning": return "yellow";
    case "Inactive": return "red";
    default: return "gray";
  }
}

function getProgressTrendColor(trend) {
  if (trend?.includes("Improving")) return "teal";
  if (trend?.includes("Declining")) return "red";
  if (trend === "Stable") return "blue";
  return "gray";
}

function getProgressTrendGradient(trend) {
  if (trend?.includes("Improving")) return 'linear-gradient(90deg, #10b981, #0ea5e9)';
  if (trend?.includes("Declining")) return 'linear-gradient(90deg, #ef4444, #f97316)';
  return 'linear-gradient(90deg, #6b7280, #9ca3af)';
}

export function LearningStateDetails({
  currentTier,
  learningStatus,
  timerBehavior,
  progressTrend,
  progressPercentage
}) {
  return (
    <Grid gutter="md" mt="md">
      <Grid.Col span={12}>
        <Card withBorder p="lg">
          <Title order={4} mb="md">Learning State Details</Title>
          <SimpleGrid cols={4} spacing="md">
            <div>
              <Text size="xs" mb={4}>Current Tier</Text>
              <Badge variant="light" color="blue" size="sm">
                {currentTier || "Unknown"}
              </Badge>
            </div>
            <div>
              <Text size="xs" mb={4}>Learning Status</Text>
              <Badge 
                variant="light" 
                color={getLearningStatusColor(learningStatus)} 
                size="sm"
              >
                {learningStatus || "No Data"}
              </Badge>
            </div>
            <div>
              <Text size="xs" mb={4}>Timer Pattern</Text>
              <Text size="sm" fw={600} style={{ color: 'var(--cm-text)' }}>
                {timerBehavior ?? "Analyzing patterns..."}
              </Text>
            </div>
            <div>
              <Text size="xs" mb={4}>Progress Trend</Text>
              <Group gap="xs" align="center">
                <Badge 
                  variant="light" 
                  color={getProgressTrendColor(progressTrend)} 
                  size="sm"
                >
                  {progressTrend || "No Data"}
                </Badge>
                <div style={{ 
                  width: '40px', 
                  height: '4px', 
                  background: 'rgba(255,255,255,0.1)', 
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${progressPercentage || 0}%`, 
                    height: '100%', 
                    background: getProgressTrendGradient(progressTrend)
                  }} />
                </div>
              </Group>
            </div>
          </SimpleGrid>
        </Card>
      </Grid.Col>
    </Grid>
  );
}