// Default settings configuration
export const DEFAULT_SETTINGS = {
  adaptive: true,
  sessionLength: 5,
  numberofNewProblemsPerSession: 2,
  limit: "off",
  reminder: { value: false, label: "6" },
  theme: "light",
  focusAreas: [],
  timerDisplay: "mm:ss",
  breakReminders: { enabled: false, interval: 25 },
  notifications: { sound: false, browser: false, visual: true },
  display: {
    sidebarWidth: "normal",
    cardSpacing: "comfortable",
    autoCollapseSidebar: true,
    chartStyle: "modern",
    chartColorScheme: "blue",
    chartAnimations: true,
    showGridLines: true,
    showChartLegends: true,
    defaultTimeRange: "30d",
    maxDataPoints: 50,
    autoRefreshData: true,
    showEmptyDataPoints: false
  },
  interviewMode: "disabled",
  interviewReadinessThreshold: 0.8,
  interviewFrequency: "manual"
};