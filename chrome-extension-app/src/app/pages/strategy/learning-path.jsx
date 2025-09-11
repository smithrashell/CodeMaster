import React, { useState } from "react";
import { Container, Grid, Card, Title, Text, Group, Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import { useLearningPathData } from "../../hooks/useLearningPathData.js";
import LearningPathVisualization from "../../components/learning/LearningPathVisualization.jsx";
import EmptyLearningPathState from "../../components/learning/EmptyLearningPathState.jsx";
import LearningPathLegend from "../../components/learning/LearningPathLegend.jsx";
import InteractiveControls from "../../components/learning/InteractiveControls.jsx";
import LearningStrategyPanel from "../../components/learning/LearningStrategyPanel.jsx";
import CurrentFocusAreas from "../../components/learning/CurrentFocusAreas.jsx";
import MasteryStatus from "../../components/learning/MasteryStatus.jsx";
import LearningEfficiencyAnalytics from "../../components/learning/LearningEfficiencyAnalytics.jsx";

export function LearningPath() {
  const { data: appState, loading, error, refresh } = usePageData('learning-path');
  const { pathData } = useLearningPathData(appState);
  const [selectedTag, setSelectedTag] = useState(null);

  if (loading) return <Container size="xl" p="md"><Text>Loading learning path data...</Text></Container>;
  if (error) return (
    <Container size="xl" p="md">
      <Text c="red">Error loading learning path data: {error.message}</Text>
      <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">
        Retry
      </Button>
    </Container>
  );

  return (
    <Container size="xl" p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Learning Path Visualization</Title>
        <Button 
          leftSection={<IconRefresh size={16} />} 
          variant="light" 
          onClick={refresh}
          size="sm"
        >
          Refresh
        </Button>
      </Group>
      
      <Grid gutter="md">
        {/* Visual Learning Path */}
        <Grid.Col span={8}>
          <Card withBorder p="lg" style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
            {/* Learning Path Visualization */}
            <div style={{ 
              position: 'relative', 
              height: '480px',
              minHeight: '480px',
              overflow: 'hidden',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              {pathData.length === 0 ? (
                <EmptyLearningPathState />
              ) : (
                <LearningPathVisualization 
                  pathData={pathData} 
                  onNodeClick={(tag) => setSelectedTag(tag)}
                />
              )}
            </div>
            
            {/* Legend and Interactive Controls */}
            <div style={{ 
              flex: 1,
              minHeight: 0,
              padding: '16px', 
              backgroundColor: 'var(--cm-card-bg)', 
              borderRadius: '8px', 
              border: '1px solid var(--cm-border)'
            }}>
              <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
                <LearningPathLegend />
                <InteractiveControls />
              </div>
            </div>
          </Card>
                   
        </Grid.Col>

        {/* Learning Strategy Intelligence Panel */}
        <Grid.Col span={4}>
          <Card withBorder p="lg" h="100%" style={{ backgroundColor: '#f8fafc', minHeight: '500px' }}>
            <LearningStrategyPanel 
              selectedTag={selectedTag}
              pathData={pathData}
              onTagDeselect={() => setSelectedTag(null)}
            />
          </Card>
        </Grid.Col>

        {/* Current Focus Areas */}
        <Grid.Col span={6}>
          <CurrentFocusAreas pathData={pathData} />
        </Grid.Col>

        {/* Mastery Status */}
        <Grid.Col span={6}>
          <MasteryStatus pathData={pathData} />
        </Grid.Col>

        {/* Learning Efficiency Analytics - Full Width */}
        <Grid.Col span={12}>
          <LearningEfficiencyAnalytics />
        </Grid.Col>
      </Grid>
    </Container>
  );
}