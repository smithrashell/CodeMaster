import React from "react";
import { Card, Group, Badge, Text, Tooltip, Progress } from "@mantine/core";
import { IconTrophy } from "@tabler/icons-react";
import { 
  getHelpLevelIcon, 
  getTagProgress, 
  getHintEffectiveness, 
  getProgressColor, 
  formatTagName 
} from './focusAreasHelpers.js';

export function FocusAreaCard({
  tag,
  masteryData,
  masteredTags,
  graduationStatus
}) {
  const progress = getTagProgress(tag, masteryData);
  const isMastered = masteredTags.includes(tag);
  const isNearMastery = graduationStatus?.nearMasteryTags?.includes(tag);
  const hintEffectiveness = getHintEffectiveness(tag, masteryData);
  const hintIcon = getHelpLevelIcon(hintEffectiveness);
  const progressColor = getProgressColor(progress, isMastered, isNearMastery);

  // Get unique problems count for tooltip
  const tagData = masteryData.find((t) => t.tag === tag);
  const uniqueProblems = tagData?.attempted_problem_ids ? new Set(tagData.attempted_problem_ids).size : 0;
  const minUniqueRequired = tagData?.min_unique_required || 20;
  const tooltipLabel = `${uniqueProblems}/${minUniqueRequired} unique problems solved - ${isMastered ? "Mastered ✨" : isNearMastery ? "Near Mastery 🔥" : "In Progress"}`;

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
        <Group gap="xs" align="center">
          <Tooltip
            label={`Hints are ${hintEffectiveness}ly helpful for this topic`}
            position="top"
          >
            <Text size="xs" style={{ cursor: "help" }}>
              {hintIcon}
            </Text>
          </Tooltip>
          <Text size="xs" fw={500} c="dimmed">
            {progress}%
          </Text>
        </Group>
      </Group>

      <Tooltip label={tooltipLabel}>
        <Progress
          value={progress}
          size="md"
          color={progressColor}
          animated={!isMastered}
        />
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