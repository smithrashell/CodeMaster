import React from "react";

/**
 * Custom Badge component with proper dark mode support
 * No Mantine dependencies - pure CSS implementation
 */
export function Badge({
  variant = "light",
  color = "blue", 
  size = "sm",
  children,
  className = "",
  ...props
}) {
  // Map colors to CSS classes
  const getColorClass = () => {
    // Handle difficulty badges (legacy support)
    if (variant === "easy") return "cm-badge--green";
    if (variant === "medium") return "cm-badge--orange"; 
    if (variant === "hard") return "cm-badge--red";
    
    // Handle status color mappings from getStatusColor function
    switch (color) {
      case "green": return "cm-badge--green";
      case "blue": return "cm-badge--blue";
      case "cyan": return "cm-badge--cyan";
      case "purple": return "cm-badge--purple";
      case "orange": return "cm-badge--orange";
      case "yellow": return "cm-badge--yellow";
      case "red": return "cm-badge--red";
      case "teal": return "cm-badge--teal";
      case "gray": 
      case "grey":
      default:
        return "cm-badge--gray";
    }
  };

  // Map sizes to CSS classes  
  const getSizeClass = () => {
    switch (size) {
      case "xs": return "cm-badge--xs";
      case "sm": return "cm-badge--sm";
      case "md": return "cm-badge--md";
      case "lg": return "cm-badge--lg";
      default: return "cm-badge--sm";
    }
  };

  // Map variants to CSS classes
  const getVariantClass = () => {
    // Handle difficulty badges as filled
    if (variant === "easy" || variant === "medium" || variant === "hard") {
      return "cm-badge--filled";
    }
    
    switch (variant) {
      case "filled": return "cm-badge--filled";
      case "outline": return "cm-badge--outline";
      case "light":
      case "secondary":
      default:
        return "cm-badge--light";
    }
  };

  const badgeClasses = [
    "cm-badge",
    getColorClass(),
    getSizeClass(), 
    getVariantClass(),
    className
  ].filter(Boolean).join(" ");

  return (
    <span className={badgeClasses} {...props}>
      {children}
    </span>
  );
}

export default Badge;
