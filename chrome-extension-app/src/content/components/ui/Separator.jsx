import React from 'react';

/**
 * Separator component - replaces Mantine Separator for content script
 */
const Separator = ({ className, orientation = 'horizontal', style = {}, ...props }) => {
  const separatorStyles = {
    ...(orientation === 'horizontal' 
      ? {
          width: '100%',
          height: '1px',
          backgroundColor: 'var(--cm-border, #e9ecef)',
          margin: '8px 0'
        }
      : {
          width: '1px',
          height: '100%',
          backgroundColor: 'var(--cm-border, #e9ecef)',
          margin: '0 8px'
        }
    ),
    ...style
  };

  return (
    <div 
      className={className} 
      style={separatorStyles}
      {...props}
    />
  );
};

export default Separator;