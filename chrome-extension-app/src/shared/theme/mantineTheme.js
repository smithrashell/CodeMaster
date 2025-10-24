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
    // Add missing colors that badges are using
    cyan: [
      "#e6fffa",
      "#b2f5ea", 
      "#81e6d9",
      "#4fd1c7",
      "#38b2ac",
      "#319795",
      "#2c7a7b",
      "#285e61",
      "#234e52",
      "#1d4044",
    ],
    violet: [
      "#faf5ff",
      "#e9d5ff",
      "#d8b4fe", 
      "#c084fc",
      "#a855f7",
      "#9333ea",
      "#7c3aed",
      "#6d28d9",
      "#5b21b6",
      "#4c1d95",
    ],
    gray: [
      "#f9fafb",
      "#f3f4f6",
      "#e5e7eb",
      "#d1d5db", 
      "#9ca3af",
      "#6b7280",
      "#4b5563",
      "#374151",
      "#1f2937",
      "#111827",
    ],
    green: [
      "#f0fff4",
      "#c6f6d5",
      "#9ae6b4",
      "#68d391",
      "#48bb78",
      "#38a169",
      "#2f855a",
      "#276749",
      "#22543d",
      "#1a202c",
    ],
    yellow: [
      "#fffff0",
      "#fefcbf",
      "#faf089",
      "#f6e05e",
      "#ecc94b",
      "#d69e2e",
      "#b7791f",
      "#975a16",
      "#744210",
      "#5f370e",
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
    
    Card: {
      styles: (theme) => ({
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

    Badge: {
      vars: (theme, props) => {
        // Use CSS variables to override badge colors based on theme
        if (theme.colorScheme === 'dark') {
          const colorOverrides = {
            blue: { bg: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' },
            cyan: { bg: 'rgba(6, 182, 212, 0.2)', color: '#67e8f9' },
            green: { bg: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' },
            orange: { bg: 'rgba(249, 115, 22, 0.2)', color: '#fdba74' },
            yellow: { bg: 'rgba(234, 179, 8, 0.2)', color: '#fde047' },
            red: { bg: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' },
            violet: { bg: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd' },
            purple: { bg: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd' },
            gray: { bg: 'rgba(107, 114, 128, 0.2)', color: '#d1d5db' },
          };

          const colorConfig = colorOverrides[props.color] || colorOverrides.gray;
          
          return {
            root: {
              '--badge-bg': colorConfig.bg,
              '--badge-color': colorConfig.color,
              '--badge-bd': `1px solid ${colorConfig.bg.replace('0.2', '0.4')}`,
            },
          };
        }
        return {};
      },
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
