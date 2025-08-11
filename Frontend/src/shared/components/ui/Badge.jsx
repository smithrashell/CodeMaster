import React from "react";
import { Badge as MantineBadge } from "@mantine/core";

/**
 * Unified Badge component using Mantine Badge with CodeMaster variants
 * Replaces the previous Tailwind-based badge system
 */
export function Badge({
  variant = "filled",
  color,
  size = "sm",
  children,
  className,
  ...props
}) {
  // Get exact hex colors matching original design
  const getInlineStyles = () => {
    if (variant === "easy") {
      return { backgroundColor: "#10b981", color: "white" };
    }
    if (variant === "medium") {
      return { backgroundColor: "#f59e0b", color: "white" };
    }
    if (variant === "hard") {
      return { backgroundColor: "#ef4444", color: "white" };
    }
    return {};
  };

  // Use neutral color for Mantine, override with inline styles
  const getMantineColor = (v, c) => {
    switch (v) {
      case "easy":
      case "medium":
      case "hard":
        return "gray"; // Will be overridden by inline styles
      case "secondary":
        return "gray";
      default:
        return c || "blue"; // Default CodeMaster blue
    }
  };

  // Map variants to Mantine equivalents
  const getMantineVariant = (v) => {
    switch (v) {
      case "outline":
        return "outline";
      case "secondary":
        return "light";
      default:
        return "filled";
    }
  };

  // Add difficulty class to prevent theme override
  const getDifficultyClass = () => {
    if (variant === "easy" || variant === "medium" || variant === "hard") {
      return "problem-sidebar-difficulty-badge";
    }
    return "";
  };

  const combinedClassName = [className, getDifficultyClass()]
    .filter(Boolean)
    .join(" ");

  return (
    <MantineBadge
      variant={getMantineVariant(variant)}
      color={getMantineColor(variant, color)}
      size={size}
      className={combinedClassName}
      style={getInlineStyles()}
      {...props}
    >
      {children}
    </MantineBadge>
  );
}

export default Badge;
