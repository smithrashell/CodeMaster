import React, { useState, useRef, useEffect } from 'react';
import { debug } from '../../../shared/utils/logger.js';
import { Box, Text, Paper, Group, ActionIcon, Stack, Badge } from '@mantine/core';
import { IconChevronDown, IconX, IconCheck } from '@tabler/icons-react';

const CustomMultiSelect = ({ 
  data = [], 
  value = [], 
  onChange, 
  label, 
  placeholder = "Select options...",
  maxValues,
  disabled = false,
  description,
  searchable = true,
  clearable = true
}) => {
  const [opened, setOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItem, setHoveredItem] = useState(null);
  const dropdownRef = useRef(null);

  // Filter data based on search query
  const filteredData = searchable 
    ? data.filter(item => 
        item.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.value?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : data;

  // Group data by group property if it exists
  const groupedData = filteredData.reduce((acc, item) => {
    const group = item.group || 'Options';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const handleToggleItem = (itemValue) => {
    if (disabled) return;

    const newValue = value.includes(itemValue)
      ? value.filter(v => v !== itemValue)
      : maxValues && value.length >= maxValues
        ? value // Don't add if at max
        : [...value, itemValue];
    
    onChange?.(newValue);
  };

  const handleRemoveItem = (itemValue) => {
    if (disabled) return;
    const newValue = value.filter(v => v !== itemValue);
    onChange?.(newValue);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange?.([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpened(false);
        setHoveredItem(null); // Clear hover state when dropdown closes
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get label for a value
  const getLabelForValue = (val) => {
    const item = data.find(d => d.value === val);
    return item?.label || val;
  };

  // Debug logging
  debug("🔍 CustomMultiSelect: value prop", { value });
  debug("🔍 CustomMultiSelect: data prop", { data });
  debug("🔍 CustomMultiSelect: value type", { type: typeof value });
  debug("🔍 CustomMultiSelect: value isArray", { isArray: Array.isArray(value) });

  return (
    <Box ref={dropdownRef} style={{ position: 'relative' }}>
      {label && (
        <Text size="sm" fw={500} mb={5}>
          {label}
        </Text>
      )}

      {/* Custom Input with Internal Badges */}
      <Box
        onClick={() => {
          if (!disabled) {
            const newOpened = !opened;
            setOpened(newOpened);
            if (!newOpened) {
              setHoveredItem(null); // Clear hover state when closing dropdown
            }
          }
        }}
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
        onMouseEnter={(e) => {
          if (!disabled && !opened) {
            e.target.style.borderColor = 'var(--mantine-color-gray-4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !opened) {
            e.target.style.borderColor = 'var(--mantine-color-default-border)';
          }
        }}
      >
        {/* Selected badges inside input */}
        {value.map(val => (
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
        ))}

        {/* Search input or placeholder */}
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

      {/* Dropdown */}
      {opened && !disabled && (
        <Paper
          shadow="md"
          p="xs"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            zIndex: 1000,
            marginTop: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: 'var(--mantine-color-body)',
            border: '1px solid var(--mantine-color-default-border)'
          }}
        >
          {Object.keys(groupedData).length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No options available
            </Text>
          ) : (
            Object.entries(groupedData).map(([groupName, items]) => (
              <Box key={groupName} mb="xs">
                {Object.keys(groupedData).length > 1 && (
                  <Text size="xs" fw={600} c="dimmed" mb={4} px="xs">
                    {groupName}
                  </Text>
                )}
                <Stack gap={2}>
                  {items.map(item => {
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
                  })}
                </Stack>
              </Box>
            ))
          )}
        </Paper>
      )}

      {/* Description */}
      {description && (
        <Text size="xs" c="dimmed" mt={4}>
          {description}
        </Text>
      )}

      {/* Max values indicator */}
      {maxValues && (
        <Text size="xs" c="dimmed" mt={2}>
          {value.length}/{maxValues} selected
        </Text>
      )}
    </Box>
  );
};

export default CustomMultiSelect;