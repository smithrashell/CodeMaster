import React from 'react';

/**
 * Custom SegmentedControl component to replace Mantine SegmentedControl
 */
const SegmentedControl = ({ 
  value, 
  onChange, 
  data = [], 
  size = "sm", 
  color = "#0066cc",
  style = {},
  ...props 
}) => {
  const containerStyles = {
    display: 'inline-flex',
    backgroundColor: '#f1f3f4',
    borderRadius: '6px',
    padding: '2px',
    border: '1px solid #e0e0e0',
    ...style
  };

  const getItemStyles = (item, isActive) => {
    const baseStyles = {
      padding: size === 'xs' ? '4px 8px' : size === 'sm' ? '6px 12px' : '8px 16px',
      border: 'none',
      background: 'transparent',
      cursor: item.disabled ? 'not-allowed' : 'pointer',
      borderRadius: '4px',
      fontSize: size === 'xs' ? '11px' : size === 'sm' ? '12px' : '14px',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      opacity: item.disabled ? 0.5 : 1,
      flex: 1,
      textAlign: 'center',
      minWidth: 'max-content'
    };

    if (isActive) {
      return {
        ...baseStyles,
        backgroundColor: color,
        color: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
      };
    }

    return {
      ...baseStyles,
      color: '#333',
      backgroundColor: 'transparent'
    };
  };

  return (
    <div style={containerStyles} {...props}>
      {data.map((item, index) => {
        const isActive = value === item.value;
        
        return (
          <button
            key={item.value || index}
            style={getItemStyles(item, isActive)}
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

export default SegmentedControl;