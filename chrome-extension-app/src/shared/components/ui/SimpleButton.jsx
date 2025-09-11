import React from "react";
import { createButtonStyles } from "./buttonStyles";
import { createHoverHandlers } from "./buttonHoverHandlers";

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
  // Create button styles using helper function
  const buttonStyles = createButtonStyles(variant, size, disabled, style);

  // Create hover handlers using helper function
  const { handleMouseEnter, handleMouseLeave } = createHoverHandlers(variant, disabled);

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