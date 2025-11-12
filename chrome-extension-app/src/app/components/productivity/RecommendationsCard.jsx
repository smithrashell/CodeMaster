import React from "react";
import { Card, Badge, Group, Title, Stack, Text, Divider, rem } from "@mantine/core";
import { IconTarget, IconClock, IconBulb, IconTrendingUp, IconFlame } from "@tabler/icons-react";

export function RecommendationsCard({ peakHour, studyStreak, avgAccuracy, totalSessions }) {
  // Generate dynamic recommendations based on actual user data
  const getRecommendations = () => {
    const recs = [];

    // 1. Peak Scheduling - Based on actual peak performance hour
    if (peakHour && peakHour !== "N/A") {
      const hourNum = parseInt(peakHour);
      const endHour = (hourNum + 2) % 24;
      const endHourStr = `${endHour.toString().padStart(2, '0')}:00`;
      recs.push({
        icon: IconClock,
        color: 'var(--mantine-color-green-5)',
        title: 'Peak scheduling',
        text: <>Schedule hard topics during your <Text span fw={600}>{peakHour}–{endHourStr}</Text> window</>
      });
    } else {
      recs.push({
        icon: IconClock,
        color: 'var(--mantine-color-green-5)',
        title: 'Peak scheduling',
        text: <>Complete more sessions to discover your optimal performance window</>
      });
    }

    // 2. Consistency - Based on study streak
    if (studyStreak > 0) {
      recs.push({
        icon: IconFlame,
        color: 'var(--mantine-color-orange-5)',
        title: 'Consistency',
        text: <>Great! Keep your <Text span fw={600}>{studyStreak}-day streak</Text> going strong</>
      });
    } else {
      recs.push({
        icon: IconBulb,
        color: 'var(--mantine-color-blue-5)',
        title: 'Consistency',
        text: <>Build momentum with <Text span fw={600}>daily sessions</Text> to start a streak</>
      });
    }

    // 3. Progress Tracking - Based on accuracy
    if (totalSessions === 0) {
      recs.push({
        icon: IconTrendingUp,
        color: 'var(--mantine-color-blue-5)',
        title: 'Progress tracking',
        text: <>Complete sessions to start tracking your <Text span fw={600}>accuracy trends</Text></>
      });
    } else if (avgAccuracy >= 80) {
      recs.push({
        icon: IconTrendingUp,
        color: 'var(--mantine-color-green-5)',
        title: 'Progress tracking',
        text: <>Excellent <Text span fw={600}>{avgAccuracy}% accuracy</Text>! Consider tackling harder problems</>
      });
    } else if (avgAccuracy < 60) {
      recs.push({
        icon: IconTrendingUp,
        color: 'var(--mantine-color-yellow-5)',
        title: 'Progress tracking',
        text: <>Review fundamentals to boost your <Text span fw={600}>{avgAccuracy}% accuracy</Text></>
      });
    } else {
      recs.push({
        icon: IconTrendingUp,
        color: 'var(--mantine-color-blue-5)',
        title: 'Progress tracking',
        text: <>Solid <Text span fw={600}>{avgAccuracy}% accuracy</Text> — track weekly trends</>
      });
    }

    return recs;
  };

  const recommendations = getRecommendations();

  return (
    <Card
      radius="md"
      p="md"
      style={{
        borderLeft: `${rem(4)} solid var(--mantine-color-green-5)`,
        backgroundColor: 'var(--mantine-color-dark-8)',
        border: '1px solid var(--mantine-color-dark-5)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '200px'
      }}
    >
      <Badge 
        variant="light" 
        color="green" 
        style={{ 
          position: 'absolute', 
          top: '12px', 
          right: '12px' 
        }}
      >
        Smart suggestions
      </Badge>
      
      <div style={{ textAlign: 'center', margin: 'auto' }}>
        <Group justify="center" gap="xs" mb="sm">
          <IconTarget size={18} />
          <Title order={4}>Recommendations</Title>
        </Group>
        
        <Stack gap="xs" align="center">
          {recommendations.map((rec, index) => (
            <div key={index} style={{ textAlign: 'center' }}>
              <Group justify="center" gap="xs" mb="xs">
                <rec.icon size={14} style={{ color: rec.color }} />
                <Text fw={600} size="sm">{rec.title}</Text>
              </Group>
              <Text size="sm">
                {rec.text}
              </Text>
              {index < 2 && <Divider my="xs" variant="dashed" />}
            </div>
          ))}
        </Stack>
      </div>
    </Card>
  );
}