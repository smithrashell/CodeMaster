import React, { useEffect, useState } from "react";

// Helper functions for highlight styles
const getSpotlightStyles = (elementRect) => ({
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 9997,
    pointerEvents: "none",
    clipPath: `polygon(
      0% 0%, 
      0% 100%, 
      ${elementRect.viewportLeft - 8}px 100%, 
      ${elementRect.viewportLeft - 8}px ${elementRect.viewportTop - 8}px, 
      ${elementRect.viewportLeft + elementRect.width + 8}px ${elementRect.viewportTop - 8}px, 
      ${elementRect.viewportLeft + elementRect.width + 8}px ${elementRect.viewportTop + elementRect.height + 8}px, 
      ${elementRect.viewportLeft - 8}px ${elementRect.viewportTop + elementRect.height + 8}px, 
      ${elementRect.viewportLeft - 8}px 100%, 
      100% 100%, 
      100% 0%
    )`
  },
  border: {
    position: "absolute",
    top: elementRect.top - 4,
    left: elementRect.left - 4,
    width: elementRect.width + 8,
    height: elementRect.height + 8,
    border: "2px solid #339af0",
    borderRadius: "8px",
    zIndex: 9998,
    pointerEvents: "none",
    animation: "onboarding-pulse 2s infinite",
    boxShadow: "0 0 20px rgba(51, 154, 240, 0.5)"
  }
});

const getOutlineStyle = (elementRect) => ({
  position: "absolute",
  top: elementRect.top - 3,
  left: elementRect.left - 3,
  width: elementRect.width + 6,
  height: elementRect.height + 6,
  border: "3px solid #339af0",
  borderRadius: "6px",
  zIndex: 9998,
  pointerEvents: "none",
  animation: "onboarding-glow 1.5s ease-in-out infinite alternate",
  backgroundColor: "rgba(51, 154, 240, 0.1)"
});

const getPointerStyles = (elementRect) => ({
  outline: {
    position: "absolute",
    top: elementRect.top - 2,
    left: elementRect.left - 2,
    width: elementRect.width + 4,
    height: elementRect.height + 4,
    border: "2px solid #339af0",
    borderRadius: "4px",
    zIndex: 9998,
    pointerEvents: "none",
    backgroundColor: "rgba(51, 154, 240, 0.05)"
  },
  arrow: {
    position: "absolute",
    top: elementRect.top - 30,
    left: elementRect.left + elementRect.width / 2 - 12,
    width: 0,
    height: 0,
    borderLeft: "12px solid transparent",
    borderRight: "12px solid transparent",
    borderTop: "20px solid #339af0",
    zIndex: 9998,
    pointerEvents: "none",
    animation: "onboarding-bounce 1s ease-in-out infinite"
  }
});

const CSS_ANIMATIONS = `
  @keyframes onboarding-pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.02);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes onboarding-glow {
    from {
      box-shadow: 0 0 10px rgba(51, 154, 240, 0.5);
    }
    to {
      box-shadow: 0 0 20px rgba(51, 154, 240, 0.8);
    }
  }

  @keyframes onboarding-bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
`;

/**
 * ElementHighlighter - Creates visual highlighting for target elements during onboarding
 * Supports spotlight effect, outline highlighting, and animated indicators
 */
export function ElementHighlighter({
  targetSelector,
  highlightType = "spotlight",
  isActive = false,
}) {
  const [_targetElement, setTargetElement] = useState(null);
  const [elementRect, setElementRect] = useState(null);

  useEffect(() => {
    if (!isActive || !targetSelector) {
      setTargetElement(null);
      setElementRect(null);
      return;
    }

    const element = document.querySelector(targetSelector);
    if (element) {
      setTargetElement(element);

      // Delay measurement until fonts/styles fully settle
      // Fixes cut-off on first render due to style application timing
      setTimeout(() => {
        updateElementRect(element);
      }, 100);

      // Scroll element into view if needed
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });

      // Update rect on scroll/resize
      const updateRect = () => updateElementRect(element);
      window.addEventListener("scroll", updateRect);
      window.addEventListener("resize", updateRect);

      return () => {
        window.removeEventListener("scroll", updateRect);
        window.removeEventListener("resize", updateRect);
      };
    }
  }, [targetSelector, isActive]);

  const updateElementRect = (element) => {
    const rect = element.getBoundingClientRect();
    const computed = window.getComputedStyle(element);

    // Default to original rect dimensions
    let finalWidth = rect.width;
    let finalLeft = rect.left;
    let finalHeight = rect.height;
    let finalTop = rect.top;

    // For navigation links in the sidebar, exclude padding from highlight box
    // This makes the blue box fit the text content instead of the full clickable area
    const shouldExcludePadding =
      element.tagName === 'A' &&
      element.closest('#cm-mySidenav') !== null;

    if (shouldExcludePadding) {
      // Extract all padding values
      const paddingLeft = parseFloat(computed.paddingLeft) || 0;
      const paddingRight = parseFloat(computed.paddingRight) || 0;
      const paddingTop = parseFloat(computed.paddingTop) || 0;
      const paddingBottom = parseFloat(computed.paddingBottom) || 0;

      // Calculate buffer based on font size for better scaling across zoom levels
      const fontSize = parseFloat(computed.fontSize) || 18;
      const BUFFER = Math.max(2, Math.round(fontSize * 0.11)); // ~10% of font size, minimum 2px

      // Adjust both horizontal and vertical dimensions to exclude padding
      finalWidth = rect.width - paddingLeft - paddingRight + (BUFFER * 2);
      finalLeft = rect.left + paddingLeft - BUFFER;
      finalHeight = rect.height - paddingTop - paddingBottom + (BUFFER * 2);
      finalTop = rect.top + paddingTop - BUFFER;
    }

    setElementRect({
      top: finalTop + window.scrollY,
      left: finalLeft + window.scrollX,
      width: finalWidth,
      height: finalHeight,
      viewportTop: finalTop,
      viewportLeft: finalLeft,
    });
  };

  if (!isActive || !elementRect) {
    return null;
  }

  const renderHighlight = () => {
    if (highlightType === "spotlight") {
      const styles = getSpotlightStyles(elementRect);
      return (
        <>
          <div style={styles.overlay} />
          <div style={styles.border} />
        </>
      );
    }

    if (highlightType === "outline") {
      return <div style={getOutlineStyle(elementRect)} />;
    }

    if (highlightType === "pointer") {
      const styles = getPointerStyles(elementRect);
      return (
        <>
          <div style={styles.outline} />
          <div style={styles.arrow} />
        </>
      );
    }

    return null;
  };

  return (
    <>
      {renderHighlight()}
      <style dangerouslySetInnerHTML={{ __html: CSS_ANIMATIONS }} />
    </>
  );
}
