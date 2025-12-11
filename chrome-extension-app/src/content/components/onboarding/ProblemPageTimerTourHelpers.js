/**
 * Helper functions and constants for ProblemPageTimerTour
 */
import logger from "../../../shared/utils/logging/logger.js";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/chromeAPIErrorHandler.js";

// Timer tour steps configuration
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

// Check if timer tour was completed
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

// Mark timer tour as completed
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
