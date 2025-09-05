import React from 'react';

// Alert color configurations
const ALERT_COLORS = {
  blue: { 
    light: { bg: '#e7f5ff', border: '#d0ebff', text: '#1971c2' },
    filled: { bg: '#228be6', text: 'white' }
  },
  green: { 
    light: { bg: '#ebfbee', border: '#d3f9d8', text: '#2f9e44' },
    filled: { bg: '#40c057', text: 'white' }
  },
  orange: { 
    light: { bg: '#fff4e6', border: '#ffe8cc', text: '#e8590c' },
    filled: { bg: '#fd7e14', text: 'white' }
  },
  red: { 
    light: { bg: '#fff5f5', border: '#ffd8d8', text: '#e03131' },
    filled: { bg: '#fa5252', text: 'white' }
  },
  yellow: { 
    light: { bg: '#fff9db', border: '#fff3bf', text: '#e67700' },
    filled: { bg: '#fab005', text: 'white' }
  },
  gray: { 
    light: { bg: '#f8f9fa', border: '#e9ecef', text: '#495057' },
    filled: { bg: '#868e96', text: 'white' }
  }
};

// Helper to get alert color values
const getAlertColors = (color, variant) => {
  const colorConfig = ALERT_COLORS[color];
  if (!colorConfig) {
    return { bg: color + '20', border: color + '40', text: color };
  }
  return colorConfig[variant] || colorConfig.light;
};

// Helper to create variant styles
const createAlertStyles = (color, variant) => {
  const colors = getAlertColors(color, variant);
  
  const styles = {
    backgroundColor: colors.bg,
    color: colors.text
  };
  
  if (variant === 'light') {
    styles.border = `1px solid ${colors.border}`;
  } else {
    styles.border = 'none';
  }
  
  return styles;
};

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
  
  const variantStyles = createAlertStyles(color, variant);
  const finalStyle = { ...baseStyle, ...variantStyles };
  
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