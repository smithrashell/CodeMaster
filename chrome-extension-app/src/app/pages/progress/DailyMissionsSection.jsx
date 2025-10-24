import { Card, Title, Group, Stack, Text, Badge, Button, ScrollArea } from "@mantine/core";
import { IconRocket } from "@tabler/icons-react";

const SECTION_HEIGHT = 700;

export function DailyMissionsSection({ 
  dailyMissions, 
  onGenerateNewMissions,
  getMissionIcon,
  getMissionColor
}) {
  return (
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
      
      <Button 
        variant="light" 
        color="teal" 
        size="sm" 
        mt="md" 
        fullWidth
        leftSection={<IconRocket size={14} />}
        onClick={onGenerateNewMissions}
      >
        Generate New Missions
      </Button>
    </Card>
  );
}