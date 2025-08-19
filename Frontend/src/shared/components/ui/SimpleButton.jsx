import React from "react";

/**
 * Simple Button component using pure HTML/CSS (no Mantine dependencies)
 * Designed to avoid styling conflicts and provide clean, readable buttons
 */
export function SimpleButton({
  variant = "primary",
  size = "sm",
  disabled = false,
  onClick,
  children,
  style = {},
  ...props
}) {
  // Base styles for all buttons
  const baseStyles = {
    border: "none",
    borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontWeight: "500",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    outline: "none",
    textDecoration: "none",
    userSelect: "none",
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  // Size variants
  const sizeStyles = {
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

  // Variant styles
  const variantStyles = {
    primary: {
      backgroundColor: "#4c6ef5",
      color: "white",
      "&:hover": !disabled && {
        backgroundColor: "#364fc7",
      },
    },
    secondary: {
      backgroundColor: "#f1f3f4",
      color: "#495057",
      "&:hover": !disabled && {
        backgroundColor: "#e9ecef",
      },
    },
    ghost: {
      backgroundColor: "transparent",
      color: "white", // Always white for visibility in dark environments
      border: "1px solid rgba(255, 255, 255, 0.3)",
      "&:hover": !disabled && {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderColor: "rgba(255, 255, 255, 0.5)",
      },
    },
  };

  // Combine all styles
  const buttonStyles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  // Handle hover effects with inline event handlers
  const handleMouseEnter = (e) => {
    if (!disabled) {
      if (variant === "primary") {
        e.target.style.backgroundColor = "#364fc7";
      } else if (variant === "secondary") {
        e.target.style.backgroundColor = "#e9ecef";
      } else if (variant === "ghost") {
        e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        e.target.style.borderColor = "rgba(255, 255, 255, 0.5)";
      }
    }
  };

  const handleMouseLeave = (e) => {
    if (!disabled) {
      if (variant === "primary") {
        e.target.style.backgroundColor = "#4c6ef5";
      } else if (variant === "secondary") {
        e.target.style.backgroundColor = "#f1f3f4";
      } else if (variant === "ghost") {
        e.target.style.backgroundColor = "transparent";
        e.target.style.borderColor = "rgba(255, 255, 255, 0.3)";
      }
    }
  };

  return (
    <button
      style={buttonStyles}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
}

export default SimpleButton;