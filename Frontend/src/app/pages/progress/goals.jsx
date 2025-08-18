import { Container, Grid, Title, Card, Text, Select, Slider, Switch, Badge, Group, Button, Stack, ScrollArea } from "@mantine/core";
import { useEffect, useState } from "react";
import { IconTarget, IconClock, IconShield, IconRocket, IconAdjustments } from "@tabler/icons-react";

const SECTION_HEIGHT = 400;

export function Goals({ appState }) {
  const [cadenceSettings, setCadenceSettings] = useState({
    sessionsPerWeek: 5,
    sessionLength: 45,
    flexibleSchedule: true
  });

  const [focusPriorities, setFocusPriorities] = useState({
    primaryTags: ["Dynamic Programming", "Graph Theory"],
    difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
    reviewRatio: 40
  });

  const [guardrails, setGuardrails] = useState({
    minReviewRatio: 30,
    maxNewProblems: 5,
    difficultyCapEnabled: true,
    maxDifficulty: "Medium",
    hintLimitEnabled: false,
    maxHintsPerProblem: 3
  });

  const [dailyMissions, setDailyMissions] = useState([
    { id: 1, title: "Complete 2 medium DP problems", progress: 1, target: 2, type: "skill", completed: false },
    { id: 2, title: "Review 3 graph problems from Box 2", progress: 3, target: 3, type: "review", completed: true },
    { id: 3, title: "Achieve 80% accuracy today", progress: 75, target: 80, type: "performance", completed: false },
    { id: 4, title: "Use max 2 hints per problem", progress: 1, target: 3, type: "efficiency", completed: false }
  ]);

  useEffect(() => {
    if (appState?.learningPlan) {
      setCadenceSettings(appState.learningPlan.cadence || cadenceSettings);
      setFocusPriorities(appState.learningPlan.focus || focusPriorities);
      setGuardrails(appState.learningPlan.guardrails || guardrails);
      setDailyMissions(appState.learningPlan.missions || dailyMissions);
    }
  }, [appState]);

  const handleCadenceChange = (field, value) => {
    setCadenceSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleGuardrailChange = (field, value) => {
    setGuardrails(prev => ({ ...prev, [field]: value }));
  };

  const getMissionIcon = (type) => {
    switch (type) {
      case "skill": return "🎯";
      case "review": return "📚";
      case "performance": return "⚡";
      case "efficiency": return "🎪";
      default: return "✨";
    }
  };

  const getMissionColor = (type) => {
    switch (type) {
      case "skill": return "blue";
      case "review": return "violet";
      case "performance": return "green";
      case "efficiency": return "orange";
      default: return "gray";
    }
  };

  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Learning Plan & Missions
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Configure your learning preferences to guide the adaptive engine
      </Text>
      
      {/* Row 3: Outcome Trends */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={12}>
          <Card withBorder p="lg">
            <Group gap="xs" mb="md">
              <IconAdjustments size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Outcome Trends & Soft Targets</Title>
              <Badge variant="light" color="cyan" size="sm">System guided</Badge>
            </Group>
            
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Weekly Accuracy Target</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    75%
                  </Text>
                  <Badge variant="light" color="green" size="xs" mt="xs">
                    On track
                  </Badge>
                </div>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Problems Per Week</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    25-30
                  </Text>
                  <Badge variant="light" color="yellow" size="xs" mt="xs">
                    Behind
                  </Badge>
                </div>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Hint Efficiency</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    &lt;2 per problem
                  </Text>
                  <Badge variant="light" color="green" size="xs" mt="xs">
                    Excellent
                  </Badge>
                </div>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Learning Velocity</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    Steady
                  </Text>
                  <Badge variant="light" color="blue" size="xs" mt="xs">
                    Adaptive
                  </Badge>
                </div>
              </Grid.Col>
            </Grid>
          </Card>
        </Grid.Col>
      </Grid>
      {/* Row 1: Cadence Commitment + Focus Priorities */}
      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconClock size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Cadence Commitment</Title>
            </Group>
            
            <Stack gap="lg">
              <div>
                <Text size="sm" fw={500} mb="xs">Sessions per week</Text>
                <Slider
                  value={cadenceSettings.sessionsPerWeek}
                  onChange={(value) => handleCadenceChange('sessionsPerWeek', value)}
                  min={1}
                  max={7}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 3, label: '3' },
                    { value: 5, label: '5' },
                    { value: 7, label: '7' }
                  ]}
                  color="blue"
                />
                <Text size="xs" c="dimmed" mt="xs">
                  Current: {cadenceSettings.sessionsPerWeek} sessions/week
                </Text>
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Session length (minutes)</Text>
                <Select
                  value={cadenceSettings.sessionLength.toString()}
                  onChange={(value) => handleCadenceChange('sessionLength', parseInt(value))}
                  data={[
                    { value: "30", label: "30 minutes" },
                    { value: "45", label: "45 minutes" },
                    { value: "60", label: "60 minutes" },
                    { value: "90", label: "90 minutes" }
                  ]}
                />
              </div>

              <Switch
                label="Flexible schedule (adapt based on performance)"
                checked={cadenceSettings.flexibleSchedule}
                onChange={(event) => handleCadenceChange('flexibleSchedule', event.currentTarget.checked)}
                color="blue"
              />
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconTarget size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Focus Priorities</Title>
            </Group>
            
            <Stack gap="lg">
              <div>
                <Text size="sm" fw={500} mb="xs">Primary focus tags</Text>
                <Group gap="xs">
                  {focusPriorities.primaryTags.map((tag, index) => (
                    <Badge key={index} variant="light" color="violet" size="sm">
                      {tag}
                    </Badge>
                  ))}
                  <Button variant="subtle" size="xs" color="violet">
                    Edit Tags
                  </Button>
                </Group>
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Difficulty distribution</Text>
                <Group gap="lg">
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={600} style={{ color: 'var(--mantine-color-green-6)' }}>
                      {focusPriorities.difficultyDistribution.easy}%
                    </Text>
                    <Text size="xs" c="dimmed">Easy</Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={600} style={{ color: 'var(--mantine-color-yellow-6)' }}>
                      {focusPriorities.difficultyDistribution.medium}%
                    </Text>
                    <Text size="xs" c="dimmed">Medium</Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={600} style={{ color: 'var(--mantine-color-red-6)' }}>
                      {focusPriorities.difficultyDistribution.hard}%
                    </Text>
                    <Text size="xs" c="dimmed">Hard</Text>
                  </div>
                </Group>
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Review ratio: {focusPriorities.reviewRatio}%</Text>
                <Slider
                  value={focusPriorities.reviewRatio}
                  onChange={(value) => setFocusPriorities(prev => ({ ...prev, reviewRatio: value }))}
                  min={0}
                  max={80}
                  step={10}
                  color="violet"
                />
                <Text size="xs" c="dimmed" mt="xs">
                  Balance between new problems and review
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Row 2: Guardrails + Daily Missions */}
      <Grid gutter="md" mt="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconShield size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Guardrails</Title>
            </Group>
            
            <Stack gap="md">
              <div>
                <Text size="sm" fw={500} mb="xs">Min review ratio: {guardrails.minReviewRatio}%</Text>
                <Slider
                  value={guardrails.minReviewRatio}
                  onChange={(value) => handleGuardrailChange('minReviewRatio', value)}
                  min={0}
                  max={60}
                  step={5}
                  color="orange"
                />
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Max new problems per session</Text>
                <Select
                  value={guardrails.maxNewProblems.toString()}
                  onChange={(value) => handleGuardrailChange('maxNewProblems', parseInt(value))}
                  data={[
                    { value: "3", label: "3 problems" },
                    { value: "5", label: "5 problems" },
                    { value: "8", label: "8 problems" },
                    { value: "10", label: "10 problems" }
                  ]}
                />
              </div>

              <Switch
                label="Enable difficulty cap"
                checked={guardrails.difficultyCapEnabled}
                onChange={(event) => handleGuardrailChange('difficultyCapEnabled', event.currentTarget.checked)}
                color="orange"
              />

              {guardrails.difficultyCapEnabled && (
                <Select
                  label="Max difficulty"
                  value={guardrails.maxDifficulty}
                  onChange={(value) => handleGuardrailChange('maxDifficulty', value)}
                  data={[
                    { value: "Easy", label: "Easy" },
                    { value: "Medium", label: "Medium" },
                    { value: "Hard", label: "Hard" }
                  ]}
                />
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconRocket size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Today&apos;s Missions</Title>
              <Badge variant="light" color="teal" size="sm">Auto-generated</Badge>
            </Group>
            
            <ScrollArea h={SECTION_HEIGHT - 140}>
              <Stack gap="xs">
                {dailyMissions.map((mission) => (
                  <Card key={mission.id} withBorder p="sm" style={{ backgroundColor: 'var(--cm-card-bg)' }}>
                    <Group justify="space-between" align="center">
                      <Group gap="xs" style={{ flex: 1 }}>
                        <Text size="sm">{getMissionIcon(mission.type)}</Text>
                        <div style={{ flex: 1 }}>
                          <Text size="sm" fw={500} style={{ 
                            textDecoration: mission.completed ? 'line-through' : 'none',
                            opacity: mission.completed ? 0.7 : 1
                          }}>
                            {mission.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {mission.type === "performance" 
                              ? `${mission.progress}% / ${mission.target}%`
                              : `${mission.progress} / ${mission.target}`
                            }
                          </Text>
                        </div>
                      </Group>
                      <Badge 
                        variant="light" 
                        color={mission.completed ? "green" : getMissionColor(mission.type)} 
                        size="sm"
                      >
                        {mission.completed ? "✓" : "In Progress"}
                      </Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
            
            <Button variant="light" color="teal" size="sm" mt="md" fullWidth>
              Generate New Missions
            </Button>
          </Card>
        </Grid.Col>
      </Grid>

    </Container>
  );
}