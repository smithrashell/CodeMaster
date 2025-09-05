import React from 'react';

/**
 * Title component - replaces Mantine Title
 * Renders heading elements with proper sizing
 */
const Title = ({ 
  children, 
  order = 2,
  size,
  style = {},
  ...props 
}) => {
  const Component = `h${Math.min(6, Math.max(1, order))}`;
  
  const defaultSizes = {
    1: '2rem',
    2: '1.625rem', 
    3: '1.375rem',
    4: '1.125rem',
    5: '1rem',
    6: '0.875rem'
  };
  
  const titleStyle = {
    fontSize: size || defaultSizes[order],
    fontWeight: '600',
    lineHeight: '1.2',
    margin: '0',
    ...style
  };
  
  return (
    <Component {...props} style={titleStyle}>
      {children}
    </Component>
  );
};

export default Title;