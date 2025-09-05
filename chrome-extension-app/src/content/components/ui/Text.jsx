import React from 'react';

/**
 * Text component - replaces Mantine Text
 * Supports size, weight, color and other text styling
 */
const Text = ({ 
  children, 
  size = 'sm',
  fw = 400, // font weight
  c, // color (Mantine prop name)
  style = {},
  ...props 
}) => {
  const fontSize = {
    xs: '0.75rem',
    sm: '0.875rem', 
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem'
  }[size] || '0.875rem';
  
  const fontWeight = {
    400: 'normal',
    500: '500',
    600: '600',
    700: 'bold'
  }[fw] || fw;
  
  const textStyle = {
    fontSize,
    fontWeight,
    color: c || style.color,
    margin: 0,
    ...style
  };
  
  return (
    <span {...props} style={textStyle}>
      {children}
    </span>
  );
};

export default Text;