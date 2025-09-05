import React, { useEffect } from 'react';
import { useMultiSelectState, useMultiSelectLogic } from '../../hooks/useMultiSelectLogic.js';
import { debug } from '../../../shared/utils/logger.js';
import { Box, Text } from '@mantine/core';
import MainInputContainer from './multiselect/MainInputContainer.jsx';
import DropdownContent from './multiselect/DropdownContent.jsx';
import { renderSelectedBadge, renderSearchInput, renderDropdownOption } from './multiselect/RenderHelpers.jsx';

function CustomMultiSelect({ 
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
}) {
  const {
    opened,
    setOpened,
    searchQuery,
    setSearchQuery,
    hoveredItem,
    setHoveredItem,
    dropdownRef,
  } = useMultiSelectState();

  const {
    groupedData,
    handleToggleItem,
    handleRemoveItem,
    handleClearAll,
    getLabelForValue,
  } = useMultiSelectLogic(data, value, onChange, disabled, maxValues, searchable, searchQuery);

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
  }, [dropdownRef, setHoveredItem, setOpened]);

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
      <MainInputContainer
        opened={opened}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            const newOpened = !opened;
            setOpened(newOpened);
            if (!newOpened) {
              setHoveredItem(null);
            }
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
        value={value}
        clearable={clearable}
        handleClearAll={handleClearAll}
        renderSelectedBadge={(val) => renderSelectedBadge(val, disabled, clearable, handleRemoveItem, getLabelForValue)}
        renderSearchInput={() => renderSearchInput({ searchable, opened, searchQuery, setSearchQuery, value, placeholder })}
      />

      {/* Dropdown */}
      <DropdownContent
        opened={opened}
        disabled={disabled}
        groupedData={groupedData}
        renderDropdownOption={(item) => renderDropdownOption({ item, value, maxValues, hoveredItem, setHoveredItem, handleToggleItem })}
      />

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
}

export default CustomMultiSelect;