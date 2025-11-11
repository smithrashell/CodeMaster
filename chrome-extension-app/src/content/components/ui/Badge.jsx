import React from 'react';

// Badge size configurations
const BADGE_SIZES = {
  xs: { fontSize: '0.625rem', padding: '2px 6px' },
  sm: { fontSize: '0.75rem', padding: '4px 8px' },
  md: { fontSize: '0.875rem', padding: '6px 12px' },
  lg: { fontSize: '1rem', padding: '8px 16px' }
};

// Badge color configurations
const BADGE_COLORS = {
  blue: { primary: '#228be6', light: '#e7f5ff', text: '#1971c2' },
  green: { primary: '#40c057', light: '#ebfbee', text: '#2f9e44' },
  orange: { primary: '#fd7e14', light: '#fff4e6', text: '#e8590c' },
  red: { primary: '#fa5252', light: '#fff5f5', text: '#e03131' },
  gray: { primary: '#868e96', light: '#f8f9fa', text: '#495057' }
};

// Helper to get badge color values
const getBadgeColors = (color) => {
  return BADGE_COLORS[color] || { primary: color, light: color + '20', text: color };
};

// Helper to create variant styles
const createBadgeStyles = (color, variant) => {
  const colors = getBadgeColors(color);
  
  switch (variant) {
    case 'filled':
      return {
        backgroundColor: colors.primary,
        color: 'white'
      };
    case 'light':
      return {
        backgroundColor: colors.light,
        color: colors.text
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        border: `1px solid ${colors.primary}`,
        color: colors.primary
      };
    default:
      return {
        backgroundColor: colors.primary,
        color: 'white'
      };
  }
};

/**
 * Badge component - replaces Mantine Badge
 * Supports different variants and colors with theming
 */
const Badge = ({
  children,
  variant = 'filled',
  color = 'blue',
  size = 'sm',
  style = {},
  ...props
}) => {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '4px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    lineHeight: '1',
    ...BADGE_SIZES[size]
  };

  const variantStyles = createBadgeStyles(color, variant);
  // Apply custom styles LAST to allow overriding variant styles
  const finalStyle = { ...baseStyle, ...variantStyles, ...style };

  return (
    <span {...props} style={finalStyle}>
      {children}
    </span>
  );
};

export default Badge;