import React from 'react';

/**
 * Alert component - replaces Mantine Alert
 * Supports different variants and colors
 */
const Alert = ({ 
  children, 
  variant = 'light',
  color = 'blue',
  icon,
  title,
  style = {},
  ...props 
}) => {
  const baseStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    ...style
  };
  
  const colorStyles = {
    light: {
      backgroundColor: color === 'blue' ? '#e7f5ff' : 
                      color === 'green' ? '#ebfbee' :
                      color === 'orange' ? '#fff4e6' :
                      color === 'red' ? '#fff5f5' :
                      color === 'yellow' ? '#fff9db' :
                      color === 'gray' ? '#f8f9fa' : color + '20',
      border: `1px solid ${color === 'blue' ? '#d0ebff' : 
                           color === 'green' ? '#d3f9d8' :
                           color === 'orange' ? '#ffe8cc' :
                           color === 'red' ? '#ffd8d8' :
                           color === 'yellow' ? '#fff3bf' :
                           color === 'gray' ? '#e9ecef' : color + '40'}`,
      color: color === 'blue' ? '#1971c2' : 
             color === 'green' ? '#2f9e44' :
             color === 'orange' ? '#e8590c' :
             color === 'red' ? '#e03131' :
             color === 'yellow' ? '#e67700' :
             color === 'gray' ? '#495057' : color
    },
    filled: {
      backgroundColor: color === 'blue' ? '#228be6' : 
                      color === 'green' ? '#40c057' :
                      color === 'orange' ? '#fd7e14' :
                      color === 'red' ? '#fa5252' :
                      color === 'yellow' ? '#fab005' :
                      color === 'gray' ? '#868e96' : color,
      color: 'white',
      border: 'none'
    }
  };
  
  const finalStyle = {
    ...baseStyle,
    ...colorStyles[variant]
  };
  
  return (
    <div {...props} style={finalStyle}>
      {icon && (
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            {title}
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Alert;