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
  const inputContainerRef = React.useRef(null);
  const portalDropdownRef = React.useRef(null);

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

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    if (!opened) return;

    const handleClickOutside = (event) => {
      // Check if click is outside both the input container and portal dropdown
      const isOutsideInput = inputContainerRef.current && !inputContainerRef.current.contains(event.target);
      const isOutsideDropdown = portalDropdownRef.current && !portalDropdownRef.current.contains(event.target);

      if (isOutsideInput && isOutsideDropdown) {
        setOpened(false);
        setHoveredItem(null);
      }
    };

    const handleScroll = (event) => {
      // Don't close dropdown if scrolling inside the dropdown itself
      if (portalDropdownRef.current && portalDropdownRef.current.contains(event.target)) {
        return;
      }
      setOpened(false);
      setHoveredItem(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [opened, inputContainerRef, dropdownRef, setHoveredItem, setOpened]);

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
      <div ref={inputContainerRef}>
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
      </div>

      {/* Dropdown */}
      <DropdownContent
        ref={portalDropdownRef}
        opened={opened}
        disabled={disabled}
        groupedData={groupedData}
        renderDropdownOption={(item) => renderDropdownOption({ item, value, maxValues, hoveredItem, setHoveredItem, handleToggleItem })}
        targetRef={inputContainerRef}
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