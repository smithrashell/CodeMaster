/**
 * SmartPositioning - Intelligent positioning system for onboarding tour cards
 * Handles responsive placement, collision detection, and viewport boundary checks
 */

export class SmartPositioning {
  constructor(options = {}) {
    this.cardWidth = options.cardWidth || 280;
    this.cardHeight = options.cardHeight || 200;
    this.padding = options.padding || 20;
    this.arrowSize = options.arrowSize || 12;
  }

  /**
   * Calculate optimal position for tour card relative to target element
   * @param {string} targetSelector - CSS selector for target element
   * @param {string} preferredPosition - Preferred position (top, bottom, left, right, center)
   * @returns {Object} Position object with coordinates and arrow placement
   */
  calculatePosition(targetSelector, preferredPosition = "auto") {
    if (!targetSelector) {
      return this.getCenterPosition();
    }

    const targetElement = document.querySelector(targetSelector);
    if (!targetElement) {
      return this.getCenterPosition();
    }

    const targetRect = targetElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };

    // If preferredPosition is auto, determine best position based on available space
    if (preferredPosition === "auto") {
      preferredPosition = this.determineBestPosition(targetRect, viewport);
    }

    const position = this.calculatePositionForDirection(
      targetRect,
      viewport,
      preferredPosition
    );

    // Check for collisions and adjust if necessary
    const adjustedPosition = this.handleCollisions(position, viewport);

    return {
      ...adjustedPosition,
      targetRect,
      arrowDirection: this.getArrowDirection(adjustedPosition.placement),
    };
  }

  /**
   * Determine the best position based on available space around target
   */
  determineBestPosition(targetRect, viewport) {
    const spaces = {
      top: targetRect.top,
      bottom: viewport.height - targetRect.bottom,
      left: targetRect.left,
      right: viewport.width - targetRect.right,
    };

    // Prefer vertical positions if target is horizontally centered
    const isHorizontallyCentered =
      targetRect.left > viewport.width * 0.25 &&
      targetRect.right < viewport.width * 0.75;

    if (isHorizontallyCentered) {
      return spaces.bottom > this.cardHeight + this.padding
        ? "bottom"
        : spaces.top > this.cardHeight + this.padding
        ? "top"
        : spaces.right > this.cardWidth + this.padding
        ? "right"
        : "left";
    }

    // For elements near edges, prefer the side with more space
    const maxSpace = Math.max(...Object.values(spaces));
    return Object.keys(spaces).find((key) => spaces[key] === maxSpace);
  }

  /**
   * Calculate position for specific direction
   */
  calculatePositionForDirection(targetRect, viewport, direction) {
    const scrollOffset = {
      x: viewport.scrollX,
      y: viewport.scrollY,
    };

    let top,
      left,
      placement = direction;

    switch (direction) {
      case "top":
        top = targetRect.top + scrollOffset.y - this.cardHeight - this.padding;
        left =
          targetRect.left +
          scrollOffset.x +
          targetRect.width / 2 -
          this.cardWidth / 2;
        break;

      case "bottom":
        top = targetRect.bottom + scrollOffset.y + this.padding;
        left =
          targetRect.left +
          scrollOffset.x +
          targetRect.width / 2 -
          this.cardWidth / 2;
        break;

      case "left":
        top =
          targetRect.top +
          scrollOffset.y +
          targetRect.height / 2 -
          this.cardHeight / 2;
        left = targetRect.left + scrollOffset.x - this.cardWidth - this.padding;
        break;

      case "right":
        top =
          targetRect.top +
          scrollOffset.y +
          targetRect.height / 2 -
          this.cardHeight / 2;
        left = targetRect.right + scrollOffset.x + this.padding;
        break;

      case "center":
      default:
        return this.getCenterPosition();
    }

    return { top, left, placement };
  }

  /**
   * Handle viewport boundary collisions
   */
  handleCollisions(position, viewport) {
    let { top, left, placement } = position;
    const scrollOffset = {
      x: viewport.scrollX,
      y: viewport.scrollY,
    };

    // Check and adjust horizontal boundaries
    if (left < scrollOffset.x + this.padding) {
      left = scrollOffset.x + this.padding;
    } else if (
      left + this.cardWidth >
      scrollOffset.x + viewport.width - this.padding
    ) {
      left = scrollOffset.x + viewport.width - this.cardWidth - this.padding;
    }

    // Check and adjust vertical boundaries
    if (top < scrollOffset.y + this.padding) {
      top = scrollOffset.y + this.padding;
    } else if (
      top + this.cardHeight >
      scrollOffset.y + viewport.height - this.padding
    ) {
      top = scrollOffset.y + viewport.height - this.cardHeight - this.padding;
    }

    return { top, left, placement };
  }

  /**
   * Get center position for non-targeted steps
   */
  getCenterPosition() {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };

    return {
      top: viewport.scrollY + viewport.height / 2 - this.cardHeight / 2,
      left: viewport.scrollX + viewport.width / 2 - this.cardWidth / 2,
      placement: "center",
      arrowDirection: null,
    };
  }

  /**
   * Get arrow direction based on card placement
   */
  getArrowDirection(placement) {
    const directions = {
      top: "down",
      bottom: "up",
      left: "right",
      right: "left",
      center: null,
    };
    return directions[placement] || null;
  }

  /**
   * Get arrow position relative to card
   */
  getArrowPosition(cardPosition, targetRect, arrowDirection) {
    if (!arrowDirection || !targetRect) {
      return null;
    }

    const cardRect = {
      top: cardPosition.top,
      left: cardPosition.left,
      width: this.cardWidth,
      height: this.cardHeight,
    };

    switch (arrowDirection) {
      case "up":
        return {
          top: -this.arrowSize,
          left: Math.max(
            this.arrowSize,
            Math.min(
              cardRect.width - this.arrowSize * 2,
              targetRect.left +
                targetRect.width / 2 -
                cardRect.left -
                this.arrowSize
            )
          ),
        };

      case "down":
        return {
          top: cardRect.height,
          left: Math.max(
            this.arrowSize,
            Math.min(
              cardRect.width - this.arrowSize * 2,
              targetRect.left +
                targetRect.width / 2 -
                cardRect.left -
                this.arrowSize
            )
          ),
        };

      case "left":
        return {
          top: Math.max(
            this.arrowSize,
            Math.min(
              cardRect.height - this.arrowSize * 2,
              targetRect.top +
                targetRect.height / 2 -
                cardRect.top -
                this.arrowSize
            )
          ),
          left: -this.arrowSize,
        };

      case "right":
        return {
          top: Math.max(
            this.arrowSize,
            Math.min(
              cardRect.height - this.arrowSize * 2,
              targetRect.top +
                targetRect.height / 2 -
                cardRect.top -
                this.arrowSize
            )
          ),
          left: cardRect.width,
        };

      default:
        return null;
    }
  }

  /**
   * Responsive breakpoint detection
   */
  getResponsiveConfig() {
    const width = window.innerWidth;

    if (width < 480) {
      return {
        cardWidth: 260,
        cardHeight: 180,
        padding: 10,
      };
    } else if (width < 768) {
      return {
        cardWidth: 280,
        cardHeight: 200,
        padding: 15,
      };
    } else {
      return {
        cardWidth: 300,
        cardHeight: 220,
        padding: 20,
      };
    }
  }
}

// Create singleton instance
export const smartPositioning = new SmartPositioning();
