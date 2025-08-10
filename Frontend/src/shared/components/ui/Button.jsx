import React from "react";
import { Button as MantineButton } from "@mantine/core";

/**
 * Unified Button component using Mantine Button with CodeMaster variants
 * Replaces the previous Tailwind-based button system
 */
export function Button({ 
  variant = "filled", 
  size = "sm", 
  color, 
  children, 
  className,
  ...props 
}) {
  // Map common variants to Mantine equivalents
  const getMantineVariant = (v) => {
    switch (v) {
      case "default":
        return "filled";
      case "destructive":
        return "filled";
      case "outline":
        return "outline";
      case "secondary":
        return "light";
      case "ghost":
        return "subtle";
      case "link":
        return "subtle";
      default:
        return v;
    }
  };

  // Map common colors for destructive variant
  const getMantineColor = (v, c) => {
    if (v === "destructive") return "red";
    if (c) return c;
    return "blue"; // Default CodeMaster blue
  };


  return (
    <MantineButton
      variant={getMantineVariant(variant)}
      size={size}
      color={getMantineColor(variant, color)}
      className={className}

      {...props}
    >
      {children}
    </MantineButton>
  );
}

export default Button;