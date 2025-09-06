import React from 'react';

/**
 * Completely custom SegmentedControl component with theme-adaptive styling
 * No Mantine dependencies or variables
 */
const CustomSegmentedControl = ({ 
  value, 
  onChange, 
  data = [], 
  options = [], 
  size = "sm", 
  style = {},
  ...props 
}) => {
  const items = options.length > 0 ? options : data;

  const containerStyle = {
    display: 'inline-flex',
    backgroundColor: 'var(--cm-bg-secondary, #f8f9fa)',
    borderRadius: '6px',
    padding: '2px',
    border: '1px solid var(--cm-border, #e9ecef)',
    ...style
  };

  const getButtonStyle = (item, isActive) => {
    const padding = size === 'xs' ? '4px 8px' : size === 'sm' ? '6px 12px' : '8px 16px';
    const fontSize = size === 'xs' ? '11px' : size === 'sm' ? '12px' : '14px';

    const baseStyle = {
      border: 'none',
      background: 'transparent',
      cursor: item.disabled ? 'not-allowed' : 'pointer',
      borderRadius: '4px',
      fontSize: fontSize,
      fontWeight: '500',
      transition: 'all 0.2s ease',
      opacity: item.disabled ? 0.5 : 1,
      flex: 1,
      textAlign: 'center',
      minWidth: 'max-content',
      padding: padding,
      outline: 'none'
    };

    if (isActive) {
      return {
        ...baseStyle,
        backgroundColor: 'var(--cm-bg-tertiary, #dee2e6)',
        color: 'var(--cm-text, #333)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        fontWeight: '600'
      };
    }

    return {
      ...baseStyle,
      color: 'var(--cm-text-secondary, #666)',
      backgroundColor: 'transparent'
    };
  };

  return (
    <div style={containerStyle} {...props}>
      {items.map((item, index) => {
        const isActive = value === item.value;
        
        return (
          <button
            key={item.value || index}
            style={getButtonStyle(item, isActive)}
            onClick={() => {
              if (!item.disabled && onChange) {
                onChange(item.value);
              }
            }}
            disabled={item.disabled}
            title={item.description}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default CustomSegmentedControl;