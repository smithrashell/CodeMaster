import React from 'react';
import { Box, Text, Badge, ActionIcon, Group } from '@mantine/core';
import { IconX, IconCheck } from '@tabler/icons-react';
import { debug } from '../../../../shared/utils/logger.js';

export function renderSelectedBadge(val, disabled, clearable, handleRemoveItem, getLabelForValue) {
  return (
    <Badge
      key={val}
      size="sm"
      rightSection={
        !disabled && clearable ? (
          <ActionIcon
            size="xs"
            radius="xl"
            variant="transparent"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveItem(val);
            }}
            style={{ 
              marginLeft: '4px',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-gray-2)'
              }
            }}
          >
            <IconX size={10} style={{ color: 'var(--mantine-color-gray-6)' }} />
          </ActionIcon>
        ) : null
      }
      style={{
        backgroundColor: 'var(--mantine-color-blue-0)',
        color: 'var(--mantine-color-blue-9)',
        border: '1px solid var(--mantine-color-blue-3)'
      }}
    >
      {getLabelForValue(val)}
    </Badge>
  );
}

export function renderSearchInput({ searchable, opened, searchQuery, setSearchQuery, value, placeholder }) {
  return (
    <Box style={{ flex: 1, minWidth: '120px' }}>
      {searchable && opened ? (
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={value.length === 0 ? placeholder : "Search..."}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            fontSize: '14px'
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Text
          size="sm"
          c={value.length === 0 ? "dimmed" : "dark"}
          style={{ 
            userSelect: 'none',
            fontSize: '14px',
            lineHeight: '20px'
          }}
        >
          {value.length === 0 ? placeholder : ''}
        </Text>
      )}
    </Box>
  );
}

export function renderDropdownOption({ item, value, maxValues, hoveredItem, setHoveredItem, handleToggleItem }) {
  const isSelected = value.includes(item.value);
  const isDisabled = !isSelected && maxValues && value.length >= maxValues;
  
  debug(`🔍 CustomMultiSelect: Item ${item.value} - isSelected: ${isSelected}`, { valueArray: value });
  
  return (
    <Box
      key={item.value}
      onClick={() => !isDisabled && handleToggleItem(item.value)}
      style={{
        padding: '8px 12px',
        borderRadius: '6px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        backgroundColor: hoveredItem === item.value && !isDisabled ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'background-color 0.2s ease'
      }}
      onMouseEnter={() => {
        if (!isDisabled) {
          setHoveredItem(item.value);
        }
      }}
      onMouseLeave={() => {
        setHoveredItem(null);
      }}
    >
      <Group gap="xs" wrap="nowrap">
        {isSelected ? (
          <Box
            style={{
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconCheck
              size={14}
              color="var(--mantine-color-blue-6)"
              stroke={2.5}
            />
          </Box>
        ) : null}
        <Box style={{ flex: 1 }}>
          <Text size="sm">{item.label}</Text>
          {item.reason && (
            <Text size="xs" c="dimmed">
              {item.reason === 'current-tier' && 'Current tier'}
              {item.reason === 'preview-locked' && 'Preview (locked)'}
              {item.reason === 'preview-unlocked' && 'Preview (unlocked)'}
            </Text>
          )}
        </Box>
      </Group>
    </Box>
  );
}