import React, { useEffect, useState } from "react";

/**
 * ElementHighlighter - Creates visual highlighting for target elements during onboarding
 * Supports spotlight effect, outline highlighting, and animated indicators
 */
export function ElementHighlighter({
  targetSelector,
  highlightType = "spotlight",
  isActive = false,
}) {
  const [targetElement, setTargetElement] = useState(null);
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
      updateElementRect(element);

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
    setElementRect({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
      viewportTop: rect.top,
      viewportLeft: rect.left,
    });
  };

  if (!isActive || !elementRect) {
    return null;
  }

  return (
    <>
      {highlightType === "spotlight" && (
        <>
          {/* Dark overlay with spotlight cutout */}
          <div
            style={{
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
                ${elementRect.viewportLeft - 8}px ${
                elementRect.viewportTop - 8
              }px, 
                ${elementRect.viewportLeft + elementRect.width + 8}px ${
                elementRect.viewportTop - 8
              }px, 
                ${elementRect.viewportLeft + elementRect.width + 8}px ${
                elementRect.viewportTop + elementRect.height + 8
              }px, 
                ${elementRect.viewportLeft - 8}px ${
                elementRect.viewportTop + elementRect.height + 8
              }px, 
                ${elementRect.viewportLeft - 8}px 100%, 
                100% 100%, 
                100% 0%
              )`,
            }}
          />

          {/* Pulsing border around highlighted element */}
          <div
            style={{
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
              boxShadow: "0 0 20px rgba(51, 154, 240, 0.5)",
            }}
          />
        </>
      )}

      {highlightType === "outline" && (
        <div
          style={{
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
            backgroundColor: "rgba(51, 154, 240, 0.1)",
          }}
        />
      )}

      {highlightType === "pointer" && (
        <>
          {/* Outline */}
          <div
            style={{
              position: "absolute",
              top: elementRect.top - 2,
              left: elementRect.left - 2,
              width: elementRect.width + 4,
              height: elementRect.height + 4,
              border: "2px solid #339af0",
              borderRadius: "4px",
              zIndex: 9998,
              pointerEvents: "none",
              backgroundColor: "rgba(51, 154, 240, 0.05)",
            }}
          />

          {/* Animated arrow pointer */}
          <div
            style={{
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
              animation: "onboarding-bounce 1s ease-in-out infinite",
            }}
          />
        </>
      )}

      {/* Add CSS animations */}
      <style jsx>{`
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
      `}</style>
    </>
  );
}
