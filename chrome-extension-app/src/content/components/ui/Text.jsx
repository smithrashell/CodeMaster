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
  margin, // full margin control
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
  
  // Handle margin - priority: margin prop > mb prop > style.margin
  const getMarginValue = () => {
    if (margin !== undefined) {
      return margin; // Use the margin prop as-is (can be string like "0px 0px 0px 8px")
    }
    if (mb !== undefined) {
      return `0 0 ${mb * 4}px 0`; // Convert mb to margin shorthand
    }
    return style.margin || style.marginBottom ? undefined : '0'; // Use style margin or default to 0
  };
  
  const finalMargin = getMarginValue();
  
  // Handle special color values like "dimmed" with proper theme awareness
  const getTextColor = () => {
    const finalColor = c || color || style.color;
    if (finalColor === 'dimmed') {
      // Get current theme from document or default to light
      const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                     document.body.classList.contains('dark-theme') ||
                     window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      
      // Return theme-appropriate dimmed color
      return isDark ? '#909296' : '#868e96'; // Darker dimmed for dark theme, lighter for light theme
    }
    
    // If no color specified, use theme-appropriate default
    if (!finalColor) {
      const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                     document.body.classList.contains('dark-theme') ||
                     window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      return isDark ? '#c9c9c9' : '#212529'; // Light text for dark theme, dark text for light theme
    }
    
    return finalColor;
  };

  const textStyle = {
    fontSize,
    fontWeight,
    color: getTextColor(),
    ...(finalMargin !== undefined && { margin: finalMargin }),
    ...style
  };
  
  return (
    <span {...props} style={textStyle}>
      {children}
    </span>
  );
};

export default Text;