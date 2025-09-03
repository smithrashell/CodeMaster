import React from 'react';

/**
 * Badge component - replaces Mantine Badge
 * Supports different variants and colors with theming
 */
const Badge = ({ 
  children, 
  variant = 'filled',
  color = 'blue',
  size = 'sm',
  style = {},
  ...props 
}) => {
  const sizes = {
    xs: { fontSize: '0.625rem', padding: '2px 6px' },
    sm: { fontSize: '0.75rem', padding: '4px 8px' },
    md: { fontSize: '0.875rem', padding: '6px 12px' },
    lg: { fontSize: '1rem', padding: '8px 16px' }
  };
  
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '4px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    lineHeight: '1',
    ...sizes[size],
    ...style
  };
  
  // Simple color mapping - can be enhanced with theme colors
  const colorStyles = {
    filled: {
      backgroundColor: color === 'blue' ? '#228be6' : 
                      color === 'green' ? '#40c057' :
                      color === 'orange' ? '#fd7e14' :
                      color === 'red' ? '#fa5252' :
                      color === 'gray' ? '#868e96' : color,
      color: 'white'
    },
    light: {
      backgroundColor: color === 'blue' ? '#e7f5ff' : 
                      color === 'green' ? '#ebfbee' :
                      color === 'orange' ? '#fff4e6' :
                      color === 'red' ? '#fff5f5' :
                      color === 'gray' ? '#f8f9fa' : color + '20',
      color: color === 'blue' ? '#1971c2' : 
             color === 'green' ? '#2f9e44' :
             color === 'orange' ? '#e8590c' :
             color === 'red' ? '#e03131' :
             color === 'gray' ? '#495057' : color
    },
    outline: {
      backgroundColor: 'transparent',
      border: `1px solid ${color === 'blue' ? '#228be6' : 
                           color === 'green' ? '#40c057' :
                           color === 'orange' ? '#fd7e14' :
                           color === 'red' ? '#fa5252' :
                           color === 'gray' ? '#868e96' : color}`,
      color: color === 'blue' ? '#228be6' : 
             color === 'green' ? '#40c057' :
             color === 'orange' ? '#fd7e14' :
             color === 'red' ? '#fa5252' :
             color === 'gray' ? '#868e96' : color
    }
  };
  
  const finalStyle = {
    ...baseStyle,
    ...colorStyles[variant]
  };
  
  return (
    <span {...props} style={finalStyle}>
      {children}
    </span>
  );
};

export default Badge;