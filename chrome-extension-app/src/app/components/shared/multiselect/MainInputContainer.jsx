import React from 'react';
import { Box, ActionIcon } from '@mantine/core';
import { IconChevronDown, IconX } from '@tabler/icons-react';

function MainInputContainer({ 
  opened, 
  disabled, 
  onClick, 
  onMouseEnter, 
  onMouseLeave, 
  value, 
  clearable, 
  handleClearAll,
  renderSelectedBadge,
  renderSearchInput 
}) {
  return (
    <Box
      onClick={onClick}
      style={{
        border: opened ? '1px solid var(--mantine-color-blue-6)' : '1px solid var(--mantine-color-default-border)',
        borderRadius: '4px',
        padding: '6px 12px',
        minHeight: '36px',
        backgroundColor: disabled ? 'var(--mantine-color-gray-1)' : 'var(--mantine-color-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        position: 'relative',
        transition: 'border-color 0.15s ease-in-out',
        ':hover': {
          borderColor: disabled ? 'var(--mantine-color-default-border)' : 'var(--mantine-color-gray-4)'
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Selected badges inside input */}
      {value.map(renderSelectedBadge)}

      {/* Search input or placeholder */}
      {renderSearchInput()}

      {/* Dropdown arrow */}
      <IconChevronDown
        size={16}
        style={{
          transform: opened ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 200ms ease',
          flexShrink: 0,
          marginLeft: '4px'
        }}
      />

      {/* Clear all button */}
      {clearable && value.length > 0 && !disabled && (
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={(e) => {
            e.stopPropagation();
            handleClearAll();
          }}
          style={{ 
            marginLeft: '4px',
            '&:hover': {
              backgroundColor: 'var(--mantine-color-gray-2)'
            }
          }}
        >
          <IconX size={14} style={{ color: 'var(--mantine-color-gray-6)' }} />
        </ActionIcon>
      )}
    </Box>
  );
}

export default MainInputContainer;