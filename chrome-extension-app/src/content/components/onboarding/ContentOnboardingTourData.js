/**
 * Content Onboarding Tour Data and Step Definitions
 * Extracted from ContentOnboardingTour.jsx
 */

export const TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to CodeMaster!",
    content:
      "Let's take a quick tour of CodeMaster's features to help you solve problems more effectively. This will only take 2 minutes.",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "intro",
    interactionType: null,
    actionPrompt: null,
  },
  {
    id: "cm-button-intro",
    title: "Your CodeMaster Control Center",
    content:
      "This 'CM' button is your gateway to all CodeMaster features. It's always available when you're on LeetCode.",
    target: "#cm-menuButton",
    position: "auto",
    highlightType: "spotlight",
    screenKey: "cmButton",
    interactionType: null,
    actionPrompt: null,
  },
  {
    id: "cm-button-interactive",
    title: "Opening the Menu",
    content:
      "Perfect! Now open CodeMaster. The sidebar will appear on the left side.",
    target: "#cm-menuButton",
    position: "auto",
    highlightType: "pointer",
    screenKey: "cmButton",
    interactionType: null,
    actionPrompt: null,
    waitForInteraction: false,
    autoTriggerSelector: "#cm-menuButton",
  },
  {
    id: "navigation-overview",
    title: "Your CodeMaster Dashboard",
    content:
      "Perfect! This is your CodeMaster dashboard. Here you can access all the tools to improve your problem-solving skills.",
    target: "#cm-mySidenav",
    position: "auto",
    highlightType: "outline",
    screenKey: "navigation",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "generator-feature",
    title: "Problem Generator",
    content:
      "Get personalized problem recommendations based on your current skill level and learning goals. This adapts as you improve!",
    target: "a[href='/Probgen']",
    position: "auto",
    highlightType: "outline",
    screenKey: "generator",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "statistics-feature",
    title: "Statistics & Box Levels",
    content:
      "View your learning progress through Leitner box levels, which show how well you've mastered different problems and your total problem count.",
    target: "a[href='/Probstat']",
    position: "auto",
    highlightType: "outline",
    screenKey: "statistics",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "settings-feature",
    title: "Settings & Preferences",
    content:
      "Customize your CodeMaster experience, adjust difficulty preferences, and configure your learning goals.",
    target: "a[href='/Settings']",
    position: "auto",
    highlightType: "outline",
    screenKey: "settings",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "guided-navigation",
    title: "Let's Explore the Problem Generator!",
    content:
      "Ready to see CodeMaster in action? We'll take you to the Problem Generator where you can find personalized problem recommendations and see how the strategy system works. Click the button below to continue your guided tour.",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "guidedNavigation",
    interactionType: null,
    actionPrompt: null,
    hasNavigationButton: true,
    navigationRoute: "/Probgen",
    navigationText: "Go to Problem Generator",
  },
  {
    id: "completion",
    title: "You're Ready to Start!",
    content:
      "You've seen CodeMaster's complete toolkit: smart problem selection, tailored strategies, and progressive hints. Click on any problem in the generator to experience the full system. Happy coding!",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "completion",
    interactionType: null,
    actionPrompt: null,
  },
];
