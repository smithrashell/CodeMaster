import React, { useState, useEffect, useRef } from "react";
import Portal from '../ui/Portal.jsx';

/**
 * Calculate optimal positioning for popover based on target and viewport
 */
const calculateOptimalPosition = (target, width, maxHeight) => {
  const targetRect = target.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // Calculate available space in each direction
  const spaceBelow = viewport.height - targetRect.bottom;
  const spaceAbove = targetRect.top;
  const spaceRight = viewport.width - targetRect.left;
  const spaceLeft = targetRect.right;

  // Determine optimal width based on available horizontal space
  let optimalWidth = Math.min(
    width,
    Math.max(280, spaceRight - 20, spaceLeft - 20)
  );

  // Determine vertical placement (bottom vs top)
  const requiredHeight = Math.min(maxHeight, 350);
  const useBottom =
    spaceBelow >= requiredHeight + 20 ||
    (spaceBelow > spaceAbove && spaceBelow >= 200);

  // Determine horizontal placement (start vs end)
  let useStart = spaceRight >= optimalWidth + 10;

  // If not enough space on the right, try left alignment
  if (!useStart && spaceLeft >= optimalWidth + 10) {
    useStart = false; // Use end positioning
  } else if (!useStart) {
    // Not enough space on either side, center it and reduce width further
    useStart = true;
    optimalWidth = Math.min(optimalWidth, viewport.width - 40);
  }

  // Calculate actual positions
  let x, y;
  let placement;

  if (useBottom) {
    y = targetRect.bottom + 8; // 8px offset below target
    placement = useStart ? "bottom-start" : "bottom-end";
  } else {
    y = targetRect.top - Math.min(maxHeight, 250) - 8; // 8px offset above target
    placement = useStart ? "top-start" : "top-end";
  }

  if (useStart) {
    x = targetRect.left;
  } else {
    x = targetRect.right - optimalWidth;
  }

  // Ensure popover doesn't go off screen horizontally
  x = Math.max(10, Math.min(x, viewport.width - optimalWidth - 10));

  // Ensure popover doesn't go off screen vertically
  if (useBottom) {
    // For bottom placement, ensure there's enough space for the full popover
    const availableBottomSpace = viewport.height - y;
    if (availableBottomSpace < Math.min(maxHeight, 300)) {
      // Not enough space below, switch to top placement
      y = targetRect.top - Math.min(maxHeight, 350) - 8;
      placement = useStart ? "top-start" : "top-end";
    }
    // Ensure we don't go below viewport
    y = Math.min(y, viewport.height - Math.min(maxHeight, 300) - 20);
  } else {
    // For top placement, ensure we don't go above viewport
    y = Math.max(20, y);
  }

  return { x, y, placement, optimalWidth };
};

/**
 * Get arrow styles based on placement and width
 */
const getArrowStyles = (placement, actualWidth) => {
  const baseArrowStyle = {
    position: "absolute",
    width: 0,
    height: 0,
    border: "6px solid transparent",
  };

  const baseBorderStyle = {
    position: "absolute",
    width: 0,
    height: 0,
    border: "7px solid transparent",
  };

  if (placement.startsWith("bottom")) {
    return {
      arrow: {
        ...baseArrowStyle,
        top: -12,
        borderBottomColor: "white",
        borderTopWidth: 0,
        left: placement.endsWith("start") ? 16 : actualWidth - 28,
      },
      border: {
        ...baseBorderStyle,
        top: -14,
        borderBottomColor: "#e9ecef",
        borderTopWidth: 0,
        left: placement.endsWith("start") ? 15 : actualWidth - 30,
      },
    };
  }

  return {
    arrow: {
      ...baseArrowStyle,
      bottom: -12,
      borderTopColor: "white",
      borderBottomWidth: 0,
      left: placement.endsWith("start") ? 16 : actualWidth - 28,
    },
    border: {
      ...baseBorderStyle,
      bottom: -14,
      borderTopColor: "#e9ecef",
      borderBottomWidth: 0,
      left: placement.endsWith("start") ? 15 : actualWidth - 30,
    },
  };
};

/**
 * Get popover container styles
 */
const getPopoverStyles = (position, actualWidth, maxHeight) => ({
  position: "fixed",
  left: position.x,
  top: position.y,
  width: actualWidth,
  maxHeight: maxHeight,
  backgroundColor: "white",
  border: "1px solid #e9ecef",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  zIndex: 1000,
  overflowY: "auto",
  animation: "popoverFadeIn 0.15s ease-out",
});

/**
 * SmartPopover - Intelligent popover that never gets cut off at screen edges
 * Calculates optimal positioning based on available viewport space
 */
const SmartPopover = ({
  opened,
  onClose,
  target,
  children,
  width = 350,
  maxHeight = 400,
}) => {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({
    x: 0,
    y: 0,
    placement: "bottom-start",
  });
  const [actualWidth, setActualWidth] = useState(width);

  useEffect(() => {
    if (!opened || !target) return;

    const updatePosition = () => {
      const result = calculateOptimalPosition(target, width, maxHeight);
      setPosition({ x: result.x, y: result.y, placement: result.placement });
      setActualWidth(result.optimalWidth);
    };

    // Calculate position immediately
    updatePosition();

    // Recalculate on window resize
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [opened, target, width, maxHeight]);

  // Handle click outside to close
  useEffect(() => {
    if (!opened) return;

    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        target &&
        !target.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [opened, onClose, target]);

  // Handle escape key
  useEffect(() => {
    if (!opened) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [opened, onClose]);

  if (!opened) return null;

  const arrowStyles = getArrowStyles(position.placement, actualWidth);
  const popoverStyles = getPopoverStyles(position, actualWidth, maxHeight);

  return (
    <Portal>
      <div ref={popoverRef} style={popoverStyles}>
        {/* Arrow pointing to target */}
        <div style={arrowStyles.arrow} />
        <div style={arrowStyles.border} />
        {children}
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes popoverFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </Portal>
  );
};

export default SmartPopover;
