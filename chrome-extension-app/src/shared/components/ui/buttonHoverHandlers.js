/**
 * Button hover effect handlers
 */

export const createHoverHandlers = (variant, disabled) => {
  const handleMouseEnter = (e) => {
    if (disabled) return;
    
    switch (variant) {
      case "primary": {
        e.target.style.backgroundColor = "#364fc7";
        // Update icon colors for primary buttons
        const primaryIcons = e.target.querySelectorAll('svg');
        primaryIcons.forEach(icon => {
          icon.style.color = '#ffffff';
          icon.style.fill = '#ffffff';
        });
        break;
      }
      case "secondary":
        e.target.style.backgroundColor = "#e9ecef";
        break;
      case "ghost":
        e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        e.target.style.borderColor = "rgba(255, 255, 255, 0.5)";
        break;
      case "danger": {
        e.target.style.backgroundColor = "#e03131";
        const dangerIcons = e.target.querySelectorAll('svg');
        dangerIcons.forEach(icon => {
          icon.style.color = '#ffffff';
          icon.style.fill = '#ffffff';
        });
        break;
      }
    }
  };

  const handleMouseLeave = (e) => {
    if (disabled) return;
    
    switch (variant) {
      case "primary": {
        e.target.style.backgroundColor = "#4c6ef5";
        // Update icon colors for primary buttons
        const primaryIcons = e.target.querySelectorAll('svg');
        primaryIcons.forEach(icon => {
          icon.style.color = '#ffffff';
          icon.style.fill = '#ffffff';
        });
        break;
      }
      case "secondary":
        e.target.style.backgroundColor = "#f1f3f4";
        break;
      case "ghost":
        e.target.style.backgroundColor = "transparent";
        e.target.style.borderColor = "rgba(255, 255, 255, 0.3)";
        break;
      case "danger": {
        e.target.style.backgroundColor = "#fa5252";
        const dangerIconsLeave = e.target.querySelectorAll('svg');
        dangerIconsLeave.forEach(icon => {
          icon.style.color = '#ffffff';
          icon.style.fill = '#ffffff';
        });
        break;
      }
    }
  };

  return { handleMouseEnter, handleMouseLeave };
};