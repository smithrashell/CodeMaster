import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, Input, Paper, Checkbox, Group, Badge, ActionIcon, Stack } from '@mantine/core';
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
  console.log("🔍 CustomMultiSelect: value prop:", value);
  console.log("🔍 CustomMultiSelect: data prop:", data);
  console.log("🔍 CustomMultiSelect: value type:", typeof value);
  console.log("🔍 CustomMultiSelect: value isArray:", Array.isArray(value));

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
          border: opened ? '1px solid #228be6' : '1px solid #ced4da',
          borderRadius: '4px',
          padding: '6px 12px',
          minHeight: '36px',
          backgroundColor: disabled ? '#f8f9fa' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          position: 'relative',
          transition: 'border-color 0.15s ease-in-out',
          ':hover': {
            borderColor: disabled ? '#ced4da' : '#adb5bd'
          }
        }}
        onMouseEnter={(e) => {
          if (!disabled && !opened) {
            e.target.style.borderColor = '#adb5bd';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !opened) {
            e.target.style.borderColor = '#ced4da';
          }
        }}
      >
        {/* Selected badges inside input */}
        {value.map(val => (
          <Badge
            key={val}
            variant="light"
            color="gray"
            size="sm"
            rightSection={
              !disabled && clearable ? (
                <ActionIcon
                  size="xs"
                  color="gray"
                  radius="xl"
                  variant="transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveItem(val);
                  }}
                  style={{ marginLeft: '4px' }}
                >
                  <IconX size={10} />
                </ActionIcon>
              ) : null
            }
            style={{
              backgroundColor: '#f8f9fa',
              color: '#495057',
              border: '1px solid #e9ecef'
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
            color="gray"
            onClick={(e) => {
              e.stopPropagation();
              handleClearAll();
            }}
            style={{ marginLeft: '4px' }}
          >
            <IconX size={14} />
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
            backgroundColor: 'white',
            border: '1px solid #ccc'
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
                    
                    console.log(`🔍 CustomMultiSelect: Item ${item.value} - isSelected: ${isSelected}, value array:`, value);
                    
                    return (
                      <Box
                        key={item.value}
                        onClick={() => !isDisabled && handleToggleItem(item.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          backgroundColor: hoveredItem === item.value && !isDisabled ? '#f8f9fa' : 'transparent',
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
                                color="#228be6"
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