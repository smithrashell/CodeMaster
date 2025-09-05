import { useState, useRef } from 'react';

// Custom hook for multi-select state management
export const useMultiSelectState = () => {
  const [opened, setOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItem, setHoveredItem] = useState(null);
  const dropdownRef = useRef(null);

  return {
    opened,
    setOpened,
    searchQuery,
    setSearchQuery,
    hoveredItem,
    setHoveredItem,
    dropdownRef,
  };
};

// Custom hook for multi-select logic
export const useMultiSelectLogic = (data, value, onChange, options = {}) => {
  const { disabled, maxValues, searchable, searchQuery } = options;
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

  const getLabelForValue = (val) => {
    const item = data.find(d => d.value === val);
    return item?.label || val;
  };

  return {
    filteredData,
    groupedData,
    handleToggleItem,
    handleRemoveItem,
    handleClearAll,
    getLabelForValue,
  };
};