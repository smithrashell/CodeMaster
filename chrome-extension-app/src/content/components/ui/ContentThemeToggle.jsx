// Content-specific ThemeToggle without Mantine dependencies
// Preserves the exact look and feel of the original Mantine SegmentedControl
import React from 'react';
import { useTheme } from "../../../shared/provider/themeprovider";
import { IconSun, IconMoon } from "@tabler/icons-react";

export default function ContentThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();

  const options = [
    {
      value: "light",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconSun style={{ width: '16px', height: '16px' }} />
          <span>Light</span>
        </div>
      ),
    },
    {
      value: "dark",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconMoon style={{ width: '16px', height: '16px' }} />
          <span>Dark</span>
        </div>
      ),
    },
  ];

  // Styles that replicate Mantine SegmentedControl appearance with proper theming
  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: '16px', // mt="md"
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  };

  const segmentedControlStyle = {
    display: 'flex',
    backgroundColor: 'var(--cm-bg-secondary, #f8f9fa)',
    border: '1px solid var(--cm-border, #e9ecef)',
    borderRadius: '8px',
    padding: '2px',
    position: 'relative',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  const getOptionStyle = (value) => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 14px',
    cursor: 'pointer',
    borderRadius: '6px',
    backgroundColor: colorScheme === value 
      ? 'var(--cm-bg-tertiary, #dee2e6)'
      : 'transparent',
    color: colorScheme === value 
      ? 'var(--cm-text, #333)' 
      : 'var(--cm-text-secondary, #666)',
    transition: 'all 0.15s ease',
    border: 'none',
    fontSize: '14px',
    fontWeight: colorScheme === value ? '600' : '500',
    minWidth: '75px',
    zIndex: 1,
    userSelect: 'none',
    outline: 'none',
    boxShadow: colorScheme === value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
  });

  const labelStyle = {
    backgroundColor: 'transparent !important',
    background: 'none !important'
  };

  const handleOptionClick = (value) => {
    if (colorScheme !== value) {
      toggleColorScheme(value);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={segmentedControlStyle}>
        {options.map((option) => (
          <button
            key={option.value}
            style={getOptionStyle(option.value)}
            onClick={() => handleOptionClick(option.value)}
          >
            <div style={labelStyle}>{option.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}