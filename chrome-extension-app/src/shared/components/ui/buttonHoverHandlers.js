/**
 * Button hover effect handlers
 */

export const createHoverHandlers = (variant, disabled) => {
  const handleMouseEnter = (e) => {
    if (disabled) return;
    
    switch (variant) {
      case "primary":
        e.target.style.backgroundColor = "#364fc7";
        break;
      case "secondary":
        e.target.style.backgroundColor = "#e9ecef";
        break;
      case "ghost":
        e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        e.target.style.borderColor = "rgba(255, 255, 255, 0.5)";
        break;
    }
  };

  const handleMouseLeave = (e) => {
    if (disabled) return;
    
    switch (variant) {
      case "primary":
        e.target.style.backgroundColor = "#4c6ef5";
        break;
      case "secondary":
        e.target.style.backgroundColor = "#f1f3f4";
        break;
      case "ghost":
        e.target.style.backgroundColor = "transparent";
        e.target.style.borderColor = "rgba(255, 255, 255, 0.3)";
        break;
    }
  };

  return { handleMouseEnter, handleMouseLeave };
};