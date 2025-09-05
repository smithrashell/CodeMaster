export const DEFAULT_ACCESSIBILITY_SETTINGS = {
  screenReader: {
    enabled: false,
    verboseDescriptions: true,
    announceNavigation: true,
    readFormLabels: true
  },
  keyboard: {
    enhancedFocus: false,
    customShortcuts: false,
    focusTrapping: false
  },
  motor: {
    largerTargets: false,
    extendedHover: false,
    reducedMotion: false,
    stickyHover: false
  }
};

export const ACCESSIBILITY_SECTIONS = {
  screenReader: {
    icon: "IconAccessible",
    title: "Screen Reader Support",
    description: "Configure screen reader optimizations for better accessibility.",
    tooltip: "Enhanced compatibility with screen reading software",
    settings: [
      {
        key: "enabled",
        title: "Enable Screen Reader Optimizations",
        description: "Adds ARIA labels and descriptions throughout the interface"
      },
      {
        key: "verboseDescriptions",
        title: "Verbose Descriptions",
        description: "Provides detailed descriptions of charts, graphs, and complex elements",
        defaultValue: true
      },
      {
        key: "announceNavigation",
        title: "Navigation Announcements",
        description: "Announces page changes and navigation events",
        defaultValue: true
      },
      {
        key: "readFormLabels",
        title: "Form Label Reading",
        description: "Ensures all form inputs have clear, readable labels",
        defaultValue: true
      }
    ]
  },
  keyboard: {
    icon: "IconKeyboard",
    title: "Keyboard Navigation",
    description: "Configure keyboard navigation enhancements for better accessibility.",
    tooltip: "Improved keyboard accessibility and navigation",
    settings: [
      {
        key: "enhancedFocus",
        title: "Enhanced Focus Indicators",
        description: "Makes keyboard focus more visible with stronger borders and colors"
      },
      {
        key: "focusTrapping",
        title: "Focus Trapping in Modals",
        description: "Keeps keyboard focus within modal dialogs and popups"
      },
      {
        key: "customShortcuts",
        title: "Custom Keyboard Shortcuts",
        description: "Enables additional keyboard shortcuts for common actions"
      }
    ]
  },
  motor: {
    icon: "IconHandFinger",
    title: "Motor Accessibility",
    description: "Configure motor accessibility features for easier interaction.",
    tooltip: "Features for users with motor impairments",
    settings: [
      {
        key: "largerTargets",
        title: "Larger Click Targets",
        description: "Increases the size of buttons and clickable elements"
      },
      {
        key: "extendedHover",
        title: "Extended Hover Time",
        description: "Keeps hover states visible longer before they disappear"
      },
      {
        key: "reducedMotion",
        title: "Reduce Motion",
        description: "Minimizes animations and transitions that may cause discomfort"
      },
      {
        key: "stickyHover",
        title: "Sticky Hover States",
        description: "Hover effects remain until explicitly dismissed"
      }
    ]
  }
};