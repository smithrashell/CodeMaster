import { useState, useEffect } from 'react';

/**
 * Custom hook that resolves CSS custom properties to actual color values
 * for use in chart components where CSS variables don't work reliably.
 * 
 * Provides theme-aware colors with fallbacks for reliability.
 */
export const useThemeColors = () => {
  const [colors, setColors] = useState({});

  // Function to get computed CSS variable value with fallback
  const getCSSVariable = (variableName, fallback) => {
    try {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim();
      return value || fallback;
    } catch (error) {
      console.warn(`Failed to get CSS variable ${variableName}, using fallback:`, fallback);
      return fallback;
    }
  };

  // Update colors when theme changes
  const updateColors = () => {
    const resolvedColors = {
      // Text colors
      text: getCSSVariable('--cm-text', '#334155'),
      textSecondary: getCSSVariable('--cm-text-secondary', '#6b7280'),
      textMuted: getCSSVariable('--cm-text-dimmed', '#9ca3af'),

      // Chart-specific colors
      chartGrid: getCSSVariable('--cm-chart-grid', '#f3f4f6'),
      chartPrimary: getCSSVariable('--cm-chart-primary', '#3b82f6'),
      chartSuccess: getCSSVariable('--cm-chart-success', '#10b981'),
      chartWarning: getCSSVariable('--cm-chart-warning', '#f59e0b'),
      chartDanger: getCSSVariable('--cm-chart-danger', '#ef4444'),
      chartInfo: getCSSVariable('--cm-chart-info', '#8b5cf6'),
      chartSecondary: getCSSVariable('--cm-chart-secondary', '#6b7280'),

      // Background and border colors
      cardBg: getCSSVariable('--cm-card-bg', '#ffffff'),
      border: getCSSVariable('--cm-border', '#e5e7eb'),

      // Tooltip colors
      tooltipBg: getCSSVariable('--cm-tooltip-bg', '#ffffff'),
      tooltipBorder: getCSSVariable('--cm-tooltip-border', '#e5e7eb'),
      tooltipText: getCSSVariable('--cm-tooltip-text', '#111827'),

      // Semantic colors for charts (mapped from existing hardcoded values)
      success: getCSSVariable('--cm-success', '#10b981'),
      warning: getCSSVariable('--cm-warning', '#f59e0b'),
      error: getCSSVariable('--cm-error', '#ef4444'),
      info: getCSSVariable('--cm-accent', '#3b82f6'),
      
      // Chart data colors (for consistent data visualization)
      dataColors: {
        primary: getCSSVariable('--cm-chart-primary', '#3b82f6'),
        secondary: getCSSVariable('--cm-chart-secondary', '#8b5cf6'),
        tertiary: getCSSVariable('--cm-chart-warning', '#f59e0b'),
        quaternary: getCSSVariable('--cm-chart-success', '#10b981'),
        quinary: getCSSVariable('--cm-chart-danger', '#ef4444'),
        // Additional colors for multi-series charts
        data1: '#3b82f6', // blue
        data2: '#8b5cf6', // purple  
        data3: '#10b981', // green
        data4: '#f59e0b', // orange
        data5: '#ef4444', // red
        data6: '#06b6d4', // cyan
        data7: '#84cc16', // lime
        data8: '#ec4899', // pink
      }
    };

    setColors(resolvedColors);
  };

  useEffect(() => {
    // Initial color resolution
    updateColors();

    // Listen for theme changes via mutation observer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' && 
          mutation.attributeName === 'data-theme'
        ) {
          // Small delay to ensure CSS has updated
          setTimeout(updateColors, 50);
        }
      });
    });

    // Watch for theme attribute changes on document.body
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Cleanup observer on unmount
    return () => observer.disconnect();
  }, []);

  return colors;
};

export default useThemeColors;