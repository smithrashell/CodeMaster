import React from 'react';
import { Stack, Text, Divider } from '@mantine/core';
import { HintItem } from './HintItem.jsx';

export const HintsSection = ({
  title,
  hints,
  hintType,
  themeColors,
  expandedHints,
  onToggleHint,
  onHintClick,
  getHintId,
  interviewRestrictions,
}) => {
  console.log(`🔍 HintsSection [${title}] - hintType: ${hintType}, hints:`, hints, `expanded:`, expandedHints);
  
  if (!hints || hints.length === 0) {
    console.log(`⚠️ HintsSection [${title}] - No hints to display`);
    return null;
  }

  return (
    <>
      <Text
        size="sm"
        weight={600}
        style={{
          color: themeColors.text + " !important",
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: '11px'
        }}
      >
        {title} ({hints.length})
      </Text>
      
      <Stack gap={8} style={{ marginBottom: '12px' }}>
        {hints.map((hint, index) => {
          const hintId = getHintId(hint, index, hintType);
          const isExpanded = expandedHints.has(hintId);

          return (
            <HintItem
              key={hintId}
              hint={hint}
              hintId={hintId}
              index={index}
              hintType={hintType}
              isExpanded={isExpanded}
              themeColors={themeColors}
              onToggle={onToggleHint}
              onHintClick={onHintClick}
              interviewRestrictions={interviewRestrictions}
            />
          );
        })}
      </Stack>
      
      <Divider style={{ margin: '12px 0', borderColor: `${themeColors.containerBorder}50` }} />
    </>
  );
};