import React from 'react';
import { Stack, Text, Button, Group, Badge } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

export const HintItem = ({
  hint,
  hintId,
  isExpanded,
  themeColors,
  onToggle,
  _onHintClick,
  _interviewRestrictions,
  index, // Need to pass index from parent
  hintType, // Need to pass hintType from parent  
}) => {
  // Protect against undefined hints
  if (!hint) {
    console.warn('HintItem received undefined hint:', { hint, hintId, index, hintType });
    return null;
  }
  return (
    <Stack
      gap={8}
      style={{
        borderRadius: '8px',
        border: `1px solid ${themeColors.containerBorder}`,
        padding: '12px',
        background: themeColors.expandedBg,
        transition: 'all 0.2s ease'
      }}
    >
      <Group justify="space-between" align="flex-start" style={{ minHeight: '20px' }}>
        <Text
          size="sm"
          weight={500}
          style={{ 
            color: themeColors.text + " !important",
            lineHeight: 1.4,
            flex: 1
          }}
        >
          {hint.type === 'contextual' && hint.relatedTag 
            ? `${hint.primaryTag} + ${hint.relatedTag}` 
            : (hint.primaryTag || 'Strategy Hint')
          }
        </Text>
        <Button
          variant="subtle"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(hintId, hint, index, hintType);
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
            <IconChevronUp size={14} style={{ color: themeColors.text }} />
          ) : (
            <IconChevronDown size={14} style={{ color: themeColors.text }} />
          )}
        </Button>
      </Group>

      {isExpanded && (
        <Stack gap={12}>
          <Text
            size="sm"
            style={{
              color: themeColors.text + " !important",
              lineHeight: 1.5,
              opacity: 0.9,
              whiteSpace: 'pre-wrap'
            }}
          >
            {hint.tip || 'No content available'}
          </Text>

          {(hint.primaryTag || hint.relatedTag) && (
            <Group gap={4}>
              {hint.primaryTag && (
                <Badge
                  size="xs"
                  variant="outline"
                  style={{
                    color: themeColors.text,
                    borderColor: themeColors.text
                  }}
                >
                  {hint.primaryTag}
                </Badge>
              )}
              {hint.relatedTag && (
                <Badge
                  size="xs"
                  variant="outline"
                  style={{
                    color: themeColors.text,
                    borderColor: themeColors.text
                  }}
                >
                  {hint.relatedTag}
                </Badge>
              )}
            </Group>
          )}

        </Stack>
      )}
    </Stack>
  );
};