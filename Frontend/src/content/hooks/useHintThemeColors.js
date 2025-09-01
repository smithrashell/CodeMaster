import { useMemo } from 'react';
import { useTheme } from '../../shared/provider/themeprovider.jsx';

export const useHintThemeColors = () => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return useMemo(() => {
    if (isDark) {
      return {
        buttonBg: {
          collapsed: "#374151",
          expanded: "#374151",
          hover: "#4b5563"
        },
        buttonBorder: "#4b5563",
        expandedBg: "#374151",
        expandedBorder: "#4b5563",
        containerBorder: "#4b5563",
        text: "#ffffff"
      };
    } else {
      return {
        buttonBg: {
          collapsed: "#ffffff",
          expanded: "#ffffff",
          hover: "#f8f9ff"
        },
        buttonBorder: "#cccccc",
        expandedBg: "#ffffff",
        expandedBorder: "#cccccc",
        containerBorder: "#cccccc",
        text: "#000000"
      };
    }
  }, [isDark]);
};