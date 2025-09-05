import { Container, Grid, Title, Button, Group } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import MetricCard from "../analytics/MetricCard";
import ChartSkeleton from "../charts/ChartSkeleton";

export function StatsLoadingState({ refresh }) {
  return (
    <Container size="xl" p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>
          General Performance Summary
        </Title>
        <Button 
          leftSection={<IconRefresh size={16} />} 
          variant="light" 
          onClick={refresh}
          size="sm"
          loading
        >
          Refresh
        </Button>
      </Group>

      {/* Loading skeletons */}
      <Grid gutter="sm">
        <MetricCard loading={true} />
        <MetricCard loading={true} />
        <MetricCard loading={true} />
        <MetricCard loading={true} />
      </Grid>
      
      {/* Focus Areas Skeleton - Full Width Second Row */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={12}>
          <ChartSkeleton title="Focus Areas" height={200} />
        </Grid.Col>
      </Grid>

      <Grid gutter="md" mt="md">
        <Grid.Col span={6}>
          <ChartSkeleton title="Accuracy Trend" />
        </Grid.Col>
        <Grid.Col span={6}>
          <ChartSkeleton title="Learning Efficiency" />
        </Grid.Col>
      </Grid>
    </Container>
  );
}