import React from 'react';

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
  const sizes = {
    xs: { padding: '4px 8px', fontSize: '0.75rem', height: '24px' },
    sm: { padding: '6px 12px', fontSize: '0.875rem', height: '32px' },
    md: { padding: '8px 16px', fontSize: '1rem', height: '40px' },
    lg: { padding: '12px 24px', fontSize: '1.125rem', height: '48px' }
  };
  
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
    ...sizes[size],
    ...style
  };
  
  const colorStyles = {
    filled: {
      backgroundColor: color === 'blue' ? '#228be6' : 
                      color === 'green' ? '#40c057' :
                      color === 'orange' ? '#fd7e14' :
                      color === 'red' ? '#fa5252' :
                      color === 'gray' ? '#868e96' : color,
      color: 'white',
      ':hover': !disabled ? {
        backgroundColor: color === 'blue' ? '#1971c2' : 
                        color === 'green' ? '#37b24d' :
                        color === 'orange' ? '#e8590c' :
                        color === 'red' ? '#e03131' :
                        color === 'gray' ? '#6c757d' : color
      } : {}
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
    },
    subtle: {
      backgroundColor: 'transparent',
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
    <button {...props} style={finalStyle} disabled={disabled}>
      {children}
    </button>
  );
};

export default Button;