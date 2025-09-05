import React from 'react';

// Color palette constants
const COLORS = {
  blue: { primary: '#228be6', hover: '#1971c2' },
  green: { primary: '#40c057', hover: '#37b24d' },
  orange: { primary: '#fd7e14', hover: '#e8590c' },
  red: { primary: '#fa5252', hover: '#e03131' },
  gray: { primary: '#868e96', hover: '#6c757d' }
};

// Size configurations
const SIZES = {
  xs: { padding: '4px 8px', fontSize: '0.75rem', height: '24px' },
  sm: { padding: '6px 12px', fontSize: '0.875rem', height: '32px' },
  md: { padding: '8px 16px', fontSize: '1rem', height: '40px' },
  lg: { padding: '12px 24px', fontSize: '1.125rem', height: '48px' }
};

// Helper to get color value
const getColorValue = (color, type = 'primary') => {
  return COLORS[color]?.[type] || color;
};

// Helper to create variant styles
const createVariantStyles = (color) => ({
  filled: {
    backgroundColor: getColorValue(color),
    color: 'white'
  },
  outline: {
    backgroundColor: 'transparent',
    border: `1px solid ${getColorValue(color)}`,
    color: getColorValue(color)
  },
  subtle: {
    backgroundColor: 'transparent',
    color: getColorValue(color)
  }
});

/**
 * Button component - replaces Mantine Button
 * Supports different variants, sizes, and colors
 */
const Button = ({ 
  children, 
  variant = 'filled',
  size = 'sm',
  color = 'blue',
  disabled = false,
  style = {},
  ...props 
}) => {
  const baseStyle = {
    border: 'none',
    borderRadius: '4px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    userSelect: 'none',
    ...SIZES[size],
    ...style
  };
  
  const variantStyles = createVariantStyles(color);
  const finalStyle = {
    ...baseStyle,
    ...variantStyles[variant]
  };
  
  return (
    <button {...props} style={finalStyle} disabled={disabled}>
      {children}
    </button>
  );
};

export default Button;