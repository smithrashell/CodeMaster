import React from 'react';
// Removed Mantine imports - replaced with native HTML/CSS for content script compatibility
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
      <div
        style={{
          color: themeColors.text + " !important",
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: '11px',
          fontWeight: '600'
        }}
      >
        {title} ({hints.length})
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
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
      </div>
      
      <div style={{ 
        margin: '12px 0', 
        height: '1px', 
        backgroundColor: `${themeColors.containerBorder}50`,
        border: 'none'
      }} />
    </>
  );
};