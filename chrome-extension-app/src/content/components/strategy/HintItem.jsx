import React from 'react';
// Removed Mantine imports - replaced with native HTML/CSS for content script compatibility
// import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderRadius: '8px',
        border: `1px solid ${themeColors.containerBorder}`,
        padding: '12px',
        background: themeColors.expandedBg,
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        minHeight: '20px' 
      }}>
        <span
          style={{ 
            fontSize: '14px',
            fontWeight: '500',
            color: themeColors.text + " !important",
            lineHeight: 1.4,
            flex: 1
          }}
        >
          {hint.type === 'contextual' && hint.relatedTag 
            ? `${hint.primaryTag} + ${hint.relatedTag}` 
            : (hint.primaryTag || 'Strategy Hint')
          }
        </span>
        <button
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
            marginLeft: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isExpanded ? (
            <span style={{ color: themeColors.text, fontSize: '14px' }}>▲</span>
          ) : (
            <span style={{ color: themeColors.text, fontSize: '14px' }}>▼</span>
          )}
        </button>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              fontSize: '14px',
              color: themeColors.text + " !important",
              lineHeight: 1.5,
              opacity: 0.9,
              whiteSpace: 'pre-wrap'
            }}
          >
            {hint.tip || 'No content available'}
          </div>

          {(hint.primaryTag || hint.relatedTag) && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {hint.primaryTag && (
                <span
                  style={{
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: `1px solid ${themeColors.text}`,
                    color: themeColors.text,
                    background: 'transparent'
                  }}
                >
                  {hint.primaryTag}
                </span>
              )}
              {hint.relatedTag && (
                <span
                  style={{
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: `1px solid ${themeColors.text}`,
                    color: themeColors.text,
                    background: 'transparent'
                  }}
                >
                  {hint.relatedTag}
                </span>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};