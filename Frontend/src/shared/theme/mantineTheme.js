import { createTheme } from "@mantine/core";

/**
 * CodeMaster Mantine Theme Configuration
 *
 * Provides consistent design tokens and styling for the dashboard application.
 * Content scripts use separate CSS variables for injection compatibility.
 */

export const codeMasterTheme = createTheme({
  // Color scheme and primary colors
  primaryColor: "blue",
  defaultRadius: "md",

  // Custom color palette matching CodeMaster brand
  colors: {
    // Override default blue with CodeMaster blues
    blue: [
      "#e0f2ff", // lightest
      "#bae1ff",
      "#7cc4fa",
      "#47a6f5",
      "#2563eb", // primary brand blue
      "#1e40af",
      "#1e3a8a",
      "#1e293b",
      "#0f172a",
      "#020617", // darkest
    ],
    // CodeMaster accent colors
    gold: [
      "#fef3c7",
      "#fef08a",
      "#fabd22", // highlight/accent color
      "#f59e0b",
      "#d97706",
      "#b45309",
      "#92400e",
      "#78350f",
      "#451a03",
      "#1c1917",
    ],
  },

  // Typography - use Mantine defaults to avoid layout disruption
  // fontFamily: keep default
  // headings: keep default

  // Spacing scale - use Mantine defaults
  // spacing: keep default

  // Component default props and styles - minimal overrides
  components: {
    // Only keep essential overrides for our custom components
    AppShell: {
      styles: (_theme) => ({
        main: {
          paddingLeft: 0,
          paddingRight: 0,
        },
      }),
    },
    
    // Ensure proper text colors in dark mode
    Text: {
      styles: (_theme) => ({
        root: {
          color: 'var(--cm-text)',
        },
      }),
    },
    
    Title: {
      styles: (_theme) => ({
        root: {
          color: 'var(--cm-text)',
        },
      }),
    },
    
    Card: {
      styles: (_theme) => ({
        root: {
          backgroundColor: 'var(--cm-card-bg)',
          color: 'var(--cm-text)',
          borderColor: 'var(--cm-border)',
        },
      }),
    },
    
    MultiSelect: {
      styles: (_theme) => ({
        input: {
          backgroundColor: 'var(--cm-dropdown-bg)',
          color: 'var(--cm-dropdown-color)',
          borderColor: 'var(--cm-border)',
        },
        item: {
          backgroundColor: 'var(--cm-dropdown-bg)',
          color: 'var(--cm-dropdown-color)',
          '&[data-hovered]': {
            backgroundColor: 'var(--cm-link-hover-bg)',
            color: 'var(--cm-link-hover-color)',
          },
        },
        dropdown: {
          backgroundColor: 'var(--cm-dropdown-bg)',
          borderColor: 'var(--cm-border)',
        },
      }),
    },
  },

  // Global styles - minimal to avoid layout conflicts
  globalStyles: (_theme) => ({
    // Let existing app.css and theme.css handle all styling
  }),

  // Dark theme overrides
  other: {
    // Custom theme tokens that can be accessed via theme.other
    codemaster: {
      // Z-index scale
      zIndex: {
        timer: 9100,
        sidebar: 9200,
        dropdown: 9400,
        overlay: 9500,
        modal: 9600,
      },

      // Difficulty colors (for badges)
      difficulty: {
        easy: "#10b981",
        medium: "#f59e0b",
        hard: "#ef4444",
      },

      // Content script theme variables (for reference)
      contentScript: {
        bg: "var(--cm-bg)",
        text: "var(--cm-text)",
        highlight: "var(--cm-highlight)",
        btnBg: "var(--cm-btn-bg)",
        btnText: "var(--cm-btn-text)",
      },
    },
  },
});

export default codeMasterTheme;
