/**
 * Page-specific tour configurations
 * Each page can have its own contextual onboarding tour
 */

// Import Chrome messaging for database operations
import ChromeAPIErrorHandler from '../../../shared/services/chrome/chromeAPIErrorHandler.js';

export const PAGE_TOURS = {
  // Problem Generator Page Tour
  probgen: {
    id: "probgen_tour",
    storageKey: "probgen_tour_completed",
    steps: [
      {
        id: "probgen-welcome",
        title: "Smart Problem Selection",
        content: "Welcome to your personalized problem generator! Let's explore how CodeMaster selects the perfect problems for your learning level.",
        target: null,
        position: "center",
        highlightType: null,
        type: "feature",
      },
      {
        id: "problem-cards",
        title: "Problem Cards & Icons",
        content: "Each problem card shows key information: difficulty level, your attempt history, and success indicators. Look for the icons that guide your selection.",
        target: ".cm-simple-problem-item-container, .cm-simple-problem-item",
        position: "auto",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "difficulty-system",
        title: "Difficulty Indicators",
        content: "Color-coded difficulty badges help you choose appropriate challenges. Green for easier, yellow for medium, red for harder problems.",
        target: ".cm-problem-badges, .cd-difficulty",
        position: "auto",
        highlightType: "spotlight",
        type: "feature",
      },
      {
        id: "info-icon",
        title: "Problem Info Icon",
        content: "This info icon (🔍) shows detailed problem analysis when you hover over it. Let's see it in action!",
        target: ".cm-simple-problem-item-container:first-child .cm-problem-info-icon",
        position: "auto",
        highlightType: "spotlight",
        type: "feature",
        forceHover: true,
        hoverTarget: ".cm-simple-problem-item-container:first-child",
        expandedTarget: ".cm-simple-problem-item-container:first-child div[style*='maxHeight']"
      },
      {
        id: "new-badge",
        title: "NEW Problem Badge",
        content: "The 'NEW' badge indicates problems you haven't attempted yet - perfect for expanding your experience!",
        target: ".cm-simple-problem-item-container:first-child .cm-new-tag",
        position: "auto",
        highlightType: "spotlight",
        type: "feature",
      },
      {
        id: "difficulty-badge", 
        title: "Difficulty Level Badge",
        content: "Color-coded difficulty badges help you choose appropriate challenges. Green for Easy, yellow for Medium, red for Hard problems.",
        target: ".cm-simple-problem-item-container:first-child .cd-difficulty",
        position: "auto",
        highlightType: "spotlight", 
        type: "feature",
      },
      {
        id: "select-problem",
        title: "Choose Your Challenge",
        content: "Now you understand all the indicators! Click on any problem to see detailed analysis, strategy suggestions, and start your solving journey.",
        target: ".cm-simple-problem-item-container, .cm-simple-problem-link",
        position: "auto", 
        highlightType: "outline",
        type: "interaction",
      },
    ],
  },

  // Problem Details Page Tour
  probtime: {
    id: "probtime_tour",
    storageKey: "probtime_tour_completed",
    steps: [
      {
        id: "problem-analysis-hub",
        title: "Problem Analysis Hub",
        content: "This is where you analyze problems before solving. CodeMaster provides tailored strategies and insights for each problem's unique patterns.",
        target: null,
        position: "center",
        highlightType: null,
        type: "feature",
      },
      {
        id: "problem-metadata",
        title: "Problem Information",
        content: "See the problem's difficulty, acceptance rate, and your attempt history. This helps you understand what you're working with.",
        target: ".problem-info, .difficulty, .acceptance, [class*='meta'], [class*='stat']",
        position: "auto",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "strategy-tags-overview",
        title: "Strategy Tag System",
        content: "Each problem has tags that reveal specific solving strategies. This is CodeMaster's core learning system - let's explore how it works!",
        target: ".tag-strategy-simple-grid, .tag-strategy-container",
        position: "auto",
        highlightType: "outline",
        type: "strategy",
      },
      {
        id: "individual-tag-focus",
        title: "Individual Strategy Tags",
        content: "Each tag button contains tailored strategies for that problem type. These buttons reveal detailed strategy content when clicked.",
        target: ".tag-strategy-simple-grid .tag-strategy-button:first-child",
        position: "auto",
        highlightType: "spotlight",
        type: "strategy"
      },
      {
        id: "expand-tag-demo",
        title: "Strategy Section Overview",
        content: "This entire strategy section provides detailed analysis and approach suggestions for each problem type. Click any tag button to see specific strategies and patterns.",
        target: "#tour-tag-strategy-section",
        position: "auto",
        highlightType: "outline",
        type: "strategy"
      },
      {
        id: "timer-launch",
        title: "Ready to Solve?",
        content: "When you've reviewed the strategies, click here to start the timer. You'll enter solving mode with access to progressive hints and timing controls.",
        target: "[class*='timer'], [class*='start'], button[class*='primary'], .start-button",
        position: "auto",
        highlightType: "spotlight",
        type: "interaction",
      },
    ],
  },

  // Timer Page Tour
  timer: {
    id: "timer_tour",
    storageKey: "timer_tour_completed",
    steps: [
      {
        id: "solving-mode-active",
        title: "Solving Mode Active",
        content: "Welcome to solving mode! You're now timed and have access to CodeMaster's smart assistance features. Let's explore your solving toolkit.",
        target: null,
        position: "center",
        highlightType: null,
        type: "timer",
      },
      {
        id: "timer-display",
        title: "Timer & Progress",
        content: "Your solving time is tracked here. The timer helps you understand your problem-solving patterns and improve over time.",
        target: ".timer, .time-display, [class*='time'], [class*='timer']",
        position: "auto",
        highlightType: "outline",
        type: "timer",
      },
      {
        id: "hint-system-complete",
        title: "Smart Hint System",
        content: "Here's CodeMaster's secret weapon! This hint system provides progressive, contextual help tailored to each problem. Hints start with gentle nudges and become more specific as needed. You'll see different approaches, patterns, and step-by-step guidance based on the problem's tags - from subtle direction to detailed solutions.",
        target: "#smart-popover-hints",
        position: "auto",
        highlightType: "spotlight",
        type: "strategy",
        requiresMenuOpen: true, // Menu should be open when this step shows
        requiresInteraction: true,
        autoTriggerSelector: "#floating-hint-button",
        interactionType: "hint-open",
        requiresHintOpen: true, // Hint panel should remain open for this step
      },
      {
        id: "solving-controls",
        title: "Timer Controls",
        content: "Use these controls to pause when you need a break, resume when ready, or complete your attempt. CodeMaster tracks everything to help you improve!",
        target: ".timer-controls, .control-buttons, [class*='control'], .pause, .resume, .complete",
        position: "auto",
        highlightType: "outline",
        type: "timer",
      },
    ],
  },

  // Statistics Page Tour
  probstat: {
    id: "probstat_tour",
    storageKey: "probstat_tour_completed",
    steps: [
      {
        id: "analytics-overview",
        title: "Your Learning Analytics",
        content: "Here's your learning progress! You can see your Leitner box levels showing how well you've mastered different problems, and your total problem count tracking how many challenges you've completed.",
        target: null,
        position: "center",
        highlightType: null,
        type: "feature",
      },
    ],
  },

  // Dashboard/App Tour - DISABLED: Dashboard onboarding now handled by WelcomeModal
  // dashboard: {
  //   id: "dashboard_tour",
  //   storageKey: "dashboard_tour_completed",
  //   steps: [
  //     {
  //       id: "dashboard-welcome",
  //       title: "Welcome to Your Dashboard",
  //       content: "Welcome to CodeMaster's analytics dashboard! Here you can track your learning progress, analyze your problem-solving patterns, and plan your coding journey.",
  //       target: null,
  //       position: "center",
  //       highlightType: null,
  //       type: "feature",
  //     },
  //     {
  //       id: "main-navigation",
  //       title: "Dashboard Navigation",
  //       content: "Use the sidebar to navigate between different sections: Overview for key metrics, Progress for learning trends, Sessions for history, and Strategy for advanced analytics.",
  //       target: ".dashboard-navigation, [class*='nav'], [class*='sidebar'], .navigation",
  //       position: "auto",
  //       highlightType: "outline",
  //       type: "feature",
  //     },
  //     {
  //       id: "key-metrics",
  //       title: "Your Key Metrics",
  //       content: "These cards show your most important stats at a glance: problems solved, success rates, learning progress, and current focus areas.",
  //       target: ".dashboard-metrics, [class*='metric'], [class*='stats']",
  //       position: "auto",
  //       highlightType: "spotlight",
  //       type: "feature",
  //     },
  //     {
  //       id: "focus-areas",
  //       title: "Focus Areas & Goals",
  //       content: "Your personalized focus areas help you concentrate on the topics that need attention. Set goals and track daily missions to maintain consistent progress.",
  //       target: ".dashboard-focus-areas, [class*='focus'], [class*='goal']",
  //       position: "auto",
  //       highlightType: "spotlight",
  //       type: "feature",
  //     },
  //   ],
  // },

  // Settings Page Tour
  settings: {
    id: "settings_tour",
    storageKey: "settings_tour_completed",
    steps: [
      {
        id: "welcome-settings",
        title: "Welcome to Settings",
        content: "Let's walk through the key controls to customize your CodeMaster experience. Each setting affects how you practice and learn.",
        target: null,
        position: "center",
        highlightType: null,
        type: "feature",
      },
      {
        id: "adaptive-sessions",
        title: "Adaptive Sessions Toggle",
        content: "This toggle controls whether CodeMaster automatically adjusts your sessions. When ON (blue), sessions adapt based on performance. When OFF, you get manual control over session settings.",
        target: "div[style*='flex-direction: column'][style*='gap: 6px']",
        position: "right",
        highlightType: "spotlight",
        type: "feature",
      },
      {
        id: "time-limits-control",
        title: "Time Limits",
        content: "Choose your timing preference: Auto (intelligent timing), Off (no time pressure), or Fixed (specific time limits). This affects how much time pressure you feel during problems.",
        target: ".cm-form-group:nth-child(2)",
        position: "right",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "interview-mode",
        title: "Interview Mode",
        content: "🎯 Practice under interview conditions! Disabled = normal learning, Practice = limited hints, Interview = realistic interview pressure with strict timing.",
        target: ".cm-form-group:nth-child(3)",
        position: "right",
        highlightType: "spotlight",
        type: "feature",
      },
      {
        id: "reminders-toggle",
        title: "Daily Reminders",
        content: "Enable daily practice reminders to stay consistent. You can set your preferred reminder time to maintain a regular coding practice schedule.",
        target: ".cm-form-group:nth-child(4)",
        position: "right",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "save-button",
        title: "Save Your Settings",
        content: "🚨 Click Save to apply your changes! Your settings won't take effect until you save them. The blue button ensures all preferences are stored.",
        target: "#save-settings-button",
        position: "right",
        highlightType: "spotlight",
        type: "action",
      },
    ],
  },
};

/**
 * Get tour configuration for a specific page
 */
export function getTourConfig(pageId) {
  return PAGE_TOURS[pageId] || null;
}

/**
 * Check if a page tour has been completed
 */
export async function isPageTourCompleted(pageId) {
  const config = getTourConfig(pageId);
  if (!config) return true;
  
  try {
    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: 'checkPageTourStatus',
      pageId: pageId
    });
    return response;
  } catch (error) {
    console.error(`Error checking page tour status for ${pageId}:`, error);
    return false; // Default to not completed on error
  }
}

/**
 * Mark a page tour as completed
 */
export async function markPageTourCompleted(pageId) {
  try {
    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: 'markPageTourCompleted',
      pageId: pageId
    });
    return response;
  } catch (error) {
    console.error(`Error marking page tour completed for ${pageId}:`, error);
    throw error;
  }
}

/**
 * Reset a page tour (for testing)
 */
export async function resetPageTour(pageId) {
  try {
    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: 'resetPageTour',
      pageId: pageId
    });
    return response;
  } catch (error) {
    console.error(`Error resetting page tour for ${pageId}:`, error);
    throw error;
  }
}