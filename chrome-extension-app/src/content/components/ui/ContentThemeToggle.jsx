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

  // Styles that replicate Mantine SegmentedControl appearance
  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '16px', // mt="md"
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  };

  const segmentedControlStyle = {
    display: 'flex',
    backgroundColor: 'var(--cm-input-bg, #f8f9fa)',
    border: '1px solid var(--cm-border, #dee2e6)',
    borderRadius: '8px', // radius="md"
    padding: '2px',
    position: 'relative',
    fontSize: '14px', // size="sm"
    fontWeight: '500'
  };

  const getOptionStyle = (value) => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px', // size="sm" padding
    cursor: 'pointer',
    borderRadius: '6px',
    backgroundColor: colorScheme === value 
      ? 'var(--cm-primary, #228be6)' 
      : 'transparent',
    color: colorScheme === value 
      ? 'white' 
      : 'var(--cm-text, #495057)',
    transition: 'all 0.15s ease',
    border: 'none',
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '70px',
    zIndex: 1,
    userSelect: 'none'
  });

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
            onMouseEnter={(e) => {
              if (colorScheme !== option.value) {
                e.target.style.backgroundColor = 'var(--cm-hover-bg, #e9ecef)';
              }
            }}
            onMouseLeave={(e) => {
              if (colorScheme !== option.value) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}