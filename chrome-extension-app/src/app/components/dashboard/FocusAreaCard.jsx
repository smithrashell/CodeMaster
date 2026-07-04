import React from "react";
import { Card, Group, Badge, Text, Tooltip, Progress } from "@mantine/core";
import { IconTrophy } from "@tabler/icons-react";
import {
  getHelpLevelIcon,
  getTagProgress,
  calculateMasteryProgress,
  getHintEffectiveness,
  getProgressColor,
  getMasteryColor,
  formatTagName
} from './focusAreasHelpers.js';

export function FocusAreaCard({
  tag,
  masteryData,
  masteredTags,
  graduationStatus
}) {
  const coverage = getTagProgress(tag, masteryData);
  const masteryProgress = calculateMasteryProgress(tag, masteryData);
  const isMastered = masteredTags.includes(tag);
  const isNearMastery = graduationStatus?.nearMasteryTags?.includes(tag);
  const hintEffectiveness = getHintEffectiveness(tag, masteryData);
  const hintIcon = getHelpLevelIcon(hintEffectiveness);
  const progressColor = getProgressColor(coverage, isMastered, isNearMastery);
  const masteryColor = getMasteryColor(masteryProgress, isMastered);

  // Get unique problems count for tooltips
  const tagData = masteryData.find((t) => t.tag === tag);
  const uniqueProblems = tagData?.attempted_problem_ids ? new Set(tagData.attempted_problem_ids).size : 0;
  const minUniqueRequired = tagData?.min_unique_required || 20;
  const successfulAttempts = tagData?.successful_attempts ?? tagData?.successfulAttempts ?? 0;
  const totalAttempts = tagData?.total_attempts ?? tagData?.totalAttempts ?? 0;

  return (
    <Card withBorder p="sm" h="100%">
      <Group gap="xs" mb="xs" align="center" justify="space-between">
        <Badge
          color={progressColor}
          variant="light"
          size="sm"
          leftSection={isMastered ? <IconTrophy size={12} /> : null}
        >
          {formatTagName(tag)}
        </Badge>
        <Tooltip
          label={`Hints are ${hintEffectiveness}ly helpful for this topic`}
          position="top"
        >
          <Text size="xs" style={{ cursor: "help" }}>
            {hintIcon}
          </Text>
        </Tooltip>
      </Group>

      <Group gap={4} mb={4} justify="space-between">
        <Text size="xs" c="dimmed">Coverage</Text>
        <Text size="xs" c="dimmed">{coverage}%</Text>
      </Group>
      <Tooltip label={`${uniqueProblems} of ${minUniqueRequired} unique problems attempted`}>
        <Progress value={coverage} size="sm" color={progressColor} animated={!isMastered} mb="xs" />
      </Tooltip>

      <Group gap={4} mb={4} justify="space-between">
        <Text size="xs" c="dimmed">Mastery</Text>
        <Text size="xs" c="dimmed">{masteryProgress}%</Text>
      </Group>
      <Tooltip label={`${masteryProgress}% success rate (${successfulAttempts}/${totalAttempts} attempts)`}>
        <Progress value={masteryProgress} size="sm" color={masteryColor} animated={!isMastered} />
      </Tooltip>

      {isMastered && (
        <Text size="xs" c="green" mt="xs" style={{ textAlign: "center" }}>
          ✨ Mastered
        </Text>
      )}
      {isNearMastery && !isMastered && (
        <Text size="xs" c="yellow" mt="xs" style={{ textAlign: "center" }}>
          🔥 Almost there!
        </Text>
      )}
    </Card>
  );
}