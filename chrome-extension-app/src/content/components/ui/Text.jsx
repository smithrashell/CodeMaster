import React from 'react';

/**
 * Text component - replaces Mantine Text
 * Supports size, weight, color and other text styling
 */
const Text = ({ 
  children, 
  size = 'sm',
  fw = 400, // font weight
  weight, // Mantine weight prop  
  c, // color (Mantine prop name)
  color, // standard color prop
  mb, // margin bottom (Mantine prop)
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
  
  // Handle both weight and fw props
  const finalWeight = weight || fw;
  const fontWeight = {
    400: 'normal',
    500: '500',
    600: '600',
    700: 'bold'
  }[finalWeight] || finalWeight;
  
  // Handle margin bottom
  const marginBottom = mb ? `${mb * 4}px` : style.marginBottom;
  
  const textStyle = {
    fontSize,
    fontWeight,
    color: c || color || style.color,
    marginBottom,
    margin: marginBottom ? `0 0 ${marginBottom} 0` : 0,
    ...style
  };
  
  return (
    <span {...props} style={textStyle}>
      {children}
    </span>
  );
};

export default Text;