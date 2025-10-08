/**
 * Helper functions for timer tour positioning and state management
 */
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";
import logger from "../../../shared/utils/logger.js";

/**
 * Check if timer tour was completed
 */
export async function checkTimerTourCompleted() {
  try {
    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: 'checkPageTourStatus',
      pageId: 'timer_mini_tour'
    });
    return response;
  } catch (error) {
    logger.error("Error checking timer tour status:", error);
    return false;
  }
}

/**
 * Mark timer tour as completed
 */
export async function markTimerTourCompleted() {
  try {
    await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: 'markPageTourCompleted',
      pageId: 'timer_mini_tour'
    });
  } catch (error) {
    logger.error("Error marking timer tour completed:", error);
  }
}

/**
 * Helper function for finding timer link
 */
export function findTimerLinkAndPosition() {
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
 * Calculate timer button position
 */
export function calculateTimerButtonPosition(position) {
  // Check if menu is actually open and give it time to load
  const menuSidebar = document.querySelector("#cm-mySidenav");
  const menuClasses = menuSidebar ? Array.from(menuSidebar.classList) : [];
  const isMenuOpen = menuSidebar && !menuSidebar.classList.contains("cm-hidden");

  logger.info(`🕐 Positioning DEBUG: Menu sidebar found: ${!!menuSidebar}, classes: [${menuClasses.join(', ')}], isMenuOpen: ${isMenuOpen}`);

  let finalPosition = { top: position.top, left: position.left };

  if (isMenuOpen) {
    const timerLink = findTimerLinkAndPosition();

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

  logger.info(`🕐 Positioning: Step positioned at (${finalPosition.top}, ${finalPosition.left})`);

  return finalPosition;
}

/**
 * Timer tour steps configuration
 */
export const TIMER_TOUR_STEPS = [
  {
    id: "timer-welcome",
    title: "Problem Analysis Hub",
    content: "Now you're on a problem page! Let me show you CodeMaster's problem analysis features where you can view detailed problem information and record your attempts.",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "timerWelcome",
  },
  {
    id: "timer-button",
    title: "View Problem Details",
    content: "Click here to access the problem analysis page where you can see detailed problem information, strategy guides, and start tracking your solving attempts.",
    target: "a[href='/Probtime']",
    position: "auto",
    highlightType: "spotlight",
    screenKey: "timerButton",
    requiresMenuOpen: true,
  },
  {
    id: "timer-complete",
    title: "Problem Analysis Tour Complete!",
    content: "Perfect! You now know how to access CodeMaster's problem analysis features. Start exploring problem details, strategies, and track your solving progress. Happy coding!",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "timerComplete",
  },
];
