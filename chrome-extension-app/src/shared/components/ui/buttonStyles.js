/**
 * Button styling constants and utilities
 */

export const baseButtonStyles = {
  border: "none",
  borderRadius: "6px",
  fontFamily: "inherit",
  fontWeight: "500",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
  outline: "none",
  textDecoration: "none",
  userSelect: "none",
};

export const sizeStyles = {
  sm: {
    fontSize: "12px",
    padding: "6px 12px",
    height: "28px",
    minWidth: "60px",
  },
  md: {
    fontSize: "14px", 
    padding: "8px 16px",
    height: "32px",
    minWidth: "80px",
  },
  lg: {
    fontSize: "16px",
    padding: "10px 20px", 
    height: "40px",
    minWidth: "100px",
  },
};

export const variantStyles = {
  primary: {
    backgroundColor: "#4c6ef5",
    color: "white",
  },
  secondary: {
    backgroundColor: "#f1f3f4",
    color: "#495057",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.3)",
  },
};

export const hoverColors = {
  primary: "#364fc7",
  secondary: "#e9ecef",
  ghost: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
};

export const createButtonStyles = (variant, size, disabled, customStyle) => ({
  ...baseButtonStyles,
  ...sizeStyles[size],
  ...variantStyles[variant],
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
  ...customStyle,
});