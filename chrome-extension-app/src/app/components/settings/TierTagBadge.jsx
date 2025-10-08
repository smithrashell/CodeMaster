/**
 * Individual tag badge component for tier visualization
 */
import React from "react";
import { Badge, Tooltip } from "@mantine/core";
import { IconCheck, IconFocus } from "@tabler/icons-react";

export function TierTagBadge({
  tag,
  tierKey,
  selectedFocusAreas,
  currentActiveTab,
  selectedTier,
  onFocusAreasChange,
  onSelectedTierChange,
  onTierChange
}) {
  const isSelected = selectedFocusAreas.includes(tag.name);
  const isActiveTier = tierKey === currentActiveTab;
  const canSelect = isActiveTier && selectedFocusAreas.length < 3;

  let color = 'gray';
  let variant = 'light';
  let icon = null;

  if (tag.mastered) {
    color = 'green';
    icon = <IconCheck size={12} />;
  } else if (isSelected) {
    color = 'blue';
    icon = <IconFocus size={12} />;
  }

  const handleClick = () => {
    console.log('🔍 Tag clicked:', {
      tag: tag.name,
      tierKey,
      selectedTier,
      isSelected,
      isDifferentTier: selectedTier && selectedTier !== tierKey
    });

    // If clicking a tag from a different tier with existing selections, clear and start fresh
    if (selectedTier && selectedTier !== tierKey && !isSelected) {
      console.log('🔍 Clearing previous tier selections and starting fresh');
      onFocusAreasChange?.([tag.name]);
      onSelectedTierChange?.(tierKey);
      if (!isActiveTier) {
        onTierChange?.(tierKey);
      }
      return;
    }

    if (!isActiveTier) {
      onTierChange?.(tierKey);
      return;
    }

    // Toggle selection if in active tier
    if (isSelected) {
      onFocusAreasChange?.(selectedFocusAreas.filter(t => t !== tag.name));
      if (selectedFocusAreas.length === 1) {
        onSelectedTierChange?.(null);
      }
    } else if (canSelect || selectedFocusAreas.length === 0) {
      onFocusAreasChange?.([...selectedFocusAreas, tag.name]);
      if (selectedFocusAreas.length === 0) {
        onSelectedTierChange?.(tierKey);
      }
    }
  };

  const tooltipLabel = tag.mastered
    ? `${tag.name} (Mastered - ${tag.progress}%)`
    : isSelected
    ? `${tag.name} (Selected - ${tag.progress}% progress)`
    : `${tag.name} (${tag.progress}% progress)`;

  return (
    <Tooltip label={tooltipLabel} position="top" withArrow>
      <Badge
        color={color}
        variant={variant}
        leftSection={icon}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          opacity: (!tag.selectable || (!isActiveTier && !isSelected)) ? 0.6 : 1
        }}
        onClick={tag.selectable ? handleClick : undefined}
      >
        {tag.name}
      </Badge>
    </Tooltip>
  );
}
