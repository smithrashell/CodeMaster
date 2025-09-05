import React from 'react';

/**
 * Loader component - replaces Mantine Loader
 * Simple spinning loader with customizable size and color
 */
const Loader = ({ 
  size = 'md',
  color = '#228be6',
  style = {},
  ...props 
}) => {
  const sizes = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40
  };
  
  const spinnerSize = typeof size === 'number' ? size : sizes[size] || sizes.md;
  
  const loaderStyle = {
    display: 'inline-block',
    width: `${spinnerSize}px`,
    height: `${spinnerSize}px`,
    border: `2px solid ${color}20`,
    borderTop: `2px solid ${color}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    ...style
  };
  
  // Inject keyframes if not already present
  React.useEffect(() => {
    const styleId = 'loader-keyframes';
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style');
      styleSheet.id = styleId;
      styleSheet.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);
  
  return (
    <div {...props} style={loaderStyle} />
  );
};

export default Loader;