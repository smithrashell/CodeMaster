/**
 * Page-specific tour configurations
 * Each page can have its own contextual onboarding tour
 */

// Import Chrome messaging for database operations
import ChromeAPIErrorHandler from '../../../shared/services/ChromeAPIErrorHandler.js';

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
        target: ".problem-card, .cm-problem-card, [class*='problem'], [class*='card']",
        position: "auto",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "difficulty-system",
        title: "Difficulty Indicators",
        content: "Color-coded difficulty badges help you choose appropriate challenges. Green for easier, yellow for medium, red for harder problems.",
        target: ".difficulty, .badge, [class*='difficulty'], [class*='level']",
        position: "auto",
        highlightType: "spotlight",
        type: "feature",
      },
      {
        id: "problem-icons",
        title: "Status Icons",
        content: "Special icons show your progress: checkmarks for solved problems, retry icons for previous attempts, and plus signs for new challenges.",
        target: ".cm-nav-icon, .icon, [class*='icon'], [class*='status']",
        position: "auto",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "select-problem",
        title: "Choose Your Challenge",
        content: "Click on any problem to see detailed analysis, strategy suggestions, and start your solving journey. Each problem is tailored to help you learn!",
        target: ".problem-card, .cm-problem-card, [class*='problem'], a[href*='problem']",
        position: "auto",
        highlightType: "spotlight",
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
        id: "strategy-tags-grid",
        title: "Strategy Tag System",
        content: "Each problem tag (like 'Arrays', 'Dynamic Programming') reveals specific solving strategies. This is CodeMaster's core learning system!",
        target: ".tag-strategy-grid, [class*='tag'], .strategy-grid, .tags",
        position: "auto",
        highlightType: "spotlight",
        type: "strategy",
      },
      {
        id: "expandable-strategies",
        title: "Interactive Strategy Cards",
        content: "Click on any tag to expand detailed strategies, common patterns, and approach suggestions. Each tag gives you a roadmap for that problem type.",
        target: ".tag-button, .strategy-tag, [class*='tag-'], .expandable",
        position: "auto",
        highlightType: "outline",
        type: "strategy",
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
        id: "strategy-menu-access",
        title: "Access CodeMaster Strategies",
        content: "First, let's open your strategy toolkit! Click the CodeMaster button to access hints and problem-solving strategies.",
        target: "#cm-menuButton",
        position: "auto",
        highlightType: "spotlight",
        type: "interaction",
        requiresInteraction: true,
        autoTriggerSelector: "#cm-menuButton",
        interactionType: "menu-open",
        requiresMenuOpen: false, // Menu should be closed when this step shows
      },
      {
        id: "floating-hint-system",
        title: "Progressive Hint System",
        content: "Perfect! Now you can access CodeMaster's secret weapon. The floating hint button gives you progressive hints that guide you without spoiling the solution.",
        target: ".floating-hint-button, [class*='hint'], .hint-button, [class*='floating']",
        position: "auto",
        highlightType: "spotlight",
        type: "strategy",
        requiresMenuOpen: true, // Menu should be open when this step shows
      },
      {
        id: "hint-levels",
        title: "Smart Hint Progression",
        content: "Hints start with gentle nudges and gradually become more specific. You control how much help you want - from subtle direction to detailed guidance.",
        target: ".hint-content, .hint-level, [class*='hint-'], .progressive",
        position: "auto",
        highlightType: "outline",
        type: "strategy",
        requiresMenuOpen: true, // Menu should remain open for this step
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
        id: "progress-dashboard",
        title: "Your Progress Dashboard",
        content: "Welcome to your learning analytics! Here you can track your problem-solving journey, identify patterns, and see your improvement over time.",
        target: null,
        position: "center",
        highlightType: null,
        type: "feature",
      },
      {
        id: "performance-overview",
        title: "Performance Overview",
        content: "See your key metrics at a glance: problems solved, success rates, average solving times, and difficulty progression.",
        target: ".overview, .stats-overview, [class*='metric'], [class*='summary']",
        position: "auto",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "solving-patterns",
        title: "Solving Patterns",
        content: "Analyze your solving patterns across different problem types, topics, and difficulty levels. Discover your strengths and areas for improvement.",
        target: ".patterns, .charts, [class*='chart'], [class*='graph'], .analytics",
        position: "auto",
        highlightType: "spotlight",
        type: "feature",
      },
      {
        id: "progress-trends",
        title: "Progress Trends",
        content: "Track your improvement over time with detailed trend analysis. See how your solving speed and accuracy have evolved.",
        target: ".trends, .progress-chart, [class*='trend'], [class*='time-series']",
        position: "auto",
        highlightType: "outline",
        type: "feature",
      },
      {
        id: "learning-insights",
        title: "Learning Insights",
        content: "Get personalized insights about your learning journey: which topics you've mastered, areas to focus on, and recommended next steps.",
        target: ".insights, .recommendations, [class*='insight'], [class*='recommend']",
        position: "auto",
        highlightType: "spotlight",
        type: "feature",
      },
    ],
  },

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
        position: "left",
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
        target: "button",
        position: "top",
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