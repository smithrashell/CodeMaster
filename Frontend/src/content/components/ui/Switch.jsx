import React from 'react';

/**
 * Switch component - replaces Mantine Switch
 * Toggle switch for boolean values
 */
const Switch = ({ 
  checked = false,
  onChange,
  disabled = false,
  size = 'sm',
  color = 'blue',
  label,
  style = {},
  ...props 
}) => {
  const sizes = {
    xs: { width: 28, height: 16, thumbSize: 12 },
    sm: { width: 34, height: 20, thumbSize: 16 },
    md: { width: 42, height: 24, thumbSize: 20 },
    lg: { width: 50, height: 28, thumbSize: 24 }
  };
  
  const { width, height, thumbSize } = sizes[size];
  
  const trackStyle = {
    width: `${width}px`,
    height: `${height}px`,
    borderRadius: `${height / 2}px`,
    backgroundColor: checked 
      ? (color === 'blue' ? '#228be6' : 
         color === 'green' ? '#40c057' :
         color === 'orange' ? '#fd7e14' :
         color === 'red' ? '#fa5252' : color)
      : '#ced4da',
    position: 'relative',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 0.15s ease',
    display: 'inline-block',
    ...style
  };
  
  const thumbStyle = {
    width: `${thumbSize}px`,
    height: `${thumbSize}px`,
    borderRadius: '50%',
    backgroundColor: 'white',
    position: 'absolute',
    top: `${(height - thumbSize) / 2}px`,
    left: checked ? `${width - thumbSize - (height - thumbSize) / 2}px` : `${(height - thumbSize) / 2}px`,
    transition: 'left 0.15s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
  };
  
  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };
  
  if (label) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer' }} onClick={handleClick}>
        <div style={trackStyle}>
          <div style={thumbStyle} />
        </div>
        <span style={{ fontSize: '0.875rem', color: disabled ? '#868e96' : 'inherit' }}>
          {label}
        </span>
      </div>
    );
  }
  
  return (
    <div {...props} style={trackStyle} onClick={handleClick}>
      <div style={thumbStyle} />
    </div>
  );
};

export default Switch;