import React from 'react';
import { Stack, Text, Button, Group, Badge } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

export const HintItem = ({
  hint,
  hintId,
  isExpanded,
  themeColors,
  onToggle,
  onHintClick,
  interviewRestrictions,
}) => {
  return (
    <Stack
      gap={8}
      style={{
        borderRadius: '8px',
        border: `1px solid ${themeColors.borderColor}`,
        padding: '12px',
        background: themeColors.buttonBg.collapsed,
        transition: 'all 0.2s ease'
      }}
    >
      <Group justify="space-between" align="flex-start" style={{ minHeight: '20px' }}>
        <Text
          size="sm"
          weight={500}
          style={{ 
            color: themeColors.textColor,
            lineHeight: 1.4,
            flex: 1
          }}
        >
          {hint.title}
        </Text>
        <Button
          variant="subtle"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(hintId);
          }}
          style={{
            minWidth: '24px',
            width: '24px',
            height: '24px',
            padding: '0',
            flexShrink: 0,
            marginLeft: '8px'
          }}
        >
          {isExpanded ? (
            <IconChevronUp size={14} style={{ color: themeColors.iconColor }} />
          ) : (
            <IconChevronDown size={14} style={{ color: themeColors.iconColor }} />
          )}
        </Button>
      </Group>

      {isExpanded && (
        <Stack gap={12}>
          <Text
            size="sm"
            style={{
              color: themeColors.textColor,
              lineHeight: 1.5,
              opacity: 0.9,
              whiteSpace: 'pre-wrap'
            }}
          >
            {hint.content}
          </Text>

          {hint.tags && hint.tags.length > 0 && (
            <Group gap={4}>
              {hint.tags.map((tag, tagIndex) => (
                <Badge
                  key={tagIndex}
                  size="xs"
                  variant="outline"
                  style={{
                    color: themeColors.iconColor,
                    borderColor: themeColors.iconColor
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </Group>
          )}

          {interviewRestrictions.hintsAvailable && (
            <Button
              size="xs"
              variant="light"
              onClick={(e) => {
                e.stopPropagation();
                onHintClick?.(hint, hintId);
              }}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: `${themeColors.iconColor}15`,
                color: themeColors.iconColor,
                border: `1px solid ${themeColors.iconColor}30`
              }}
            >
              Use Hint
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
};