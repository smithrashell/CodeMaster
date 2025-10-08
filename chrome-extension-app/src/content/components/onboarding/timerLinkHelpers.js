/**
 * Helper functions for finding timer link in menu
 */
import logger from "../../../shared/utils/logger.js";

/**
 * Finds the timer link in the menu sidebar using multiple selectors
 * @returns {HTMLElement|null} The timer link element or null if not found
 */
export function findTimerLink() {
  // Look for the timer link with multiple selectors
  let timerLink = document.querySelector("a[href='/Probtime']") ||
                 document.querySelector("a[href*='Probtime']") ||
                 document.querySelector("#cm-mySidenav a[href*='timer']") ||
                 document.querySelector("#cm-mySidenav a[href*='Timer']");

  // Also search by text content if href search fails
  if (!timerLink) {
    const allMenuLinks = document.querySelectorAll("#cm-mySidenav a");
    for (const link of allMenuLinks) {
      const text = link.textContent?.toLowerCase() || '';
      if (text.includes('timer') || text.includes('probtime')) {
        timerLink = link;
        break;
      }
    }
  }

  // Debug all available links
  const allMenuLinks = document.querySelectorAll("#cm-mySidenav a, #cm-mySidenav button");
  const linkInfo = Array.from(allMenuLinks).map(link => ({
    tagName: link.tagName,
    href: link.href || 'no-href',
    text: link.textContent?.trim() || 'no-text',
    classes: Array.from(link.classList),
    onclick: link.onclick ? 'has-onclick' : 'no-onclick'
  }));

  logger.info(`🕐 Positioning DEBUG: Timer link found: ${!!timerLink}, all menu items:`, linkInfo);

  return timerLink;
}

/**
 * Calculates the position for the timer button step
 * @param {Object} position - Base position from smartPositioning
 * @returns {Object} Final position with top and left coordinates
 */
export function calculateTimerButtonPosition(position) {
  const menuSidebar = document.querySelector("#cm-mySidenav");
  const isMenuOpen = menuSidebar && !menuSidebar.classList.contains("cm-hidden");

  let finalPosition = { top: position.top, left: position.left };

  if (isMenuOpen) {
    const timerLink = findTimerLink();

    if (timerLink) {
      const timerRect = timerLink.getBoundingClientRect();
      logger.info(`🕐 Positioning: Found timer link at (${timerRect.top}, ${timerRect.left}, ${timerRect.right}, ${timerRect.bottom}), positioning tour to point at it`);

      // Position to the right of the timer link with proper spacing
      const viewportWidth = window.innerWidth;
      const tourWidth = 280;

      finalPosition = {
        top: Math.max(60, timerRect.top - 10), // Align with timer link top, slight offset up
        left: Math.min(
          timerRect.right + 30, // Close enough to clearly point to the timer link
          viewportWidth - tourWidth - 40 // Don't go off screen
        )
      };
    } else {
      logger.info(`🕐 Positioning: Timer link not found, using menu-relative positioning`);
      const sidebarRect = menuSidebar.getBoundingClientRect();
      finalPosition = {
        top: sidebarRect.top + 100,
        left: Math.min(
          sidebarRect.right + 30,
          window.innerWidth - 320
        )
      };
    }
  } else {
    logger.info(`🕐 Positioning: Menu not open, using default fallback positioning`);
    // Even if menu not detected as open, use a safe fallback position
    finalPosition = {
      top: 100,
      left: Math.max(350, window.innerWidth - 350)
    };
  }

  return finalPosition;
}
