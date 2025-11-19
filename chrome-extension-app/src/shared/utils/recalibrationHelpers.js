/**
 * Shared utilities for recalibration modals and UI
 *
 * Extracted from WelcomeBackModal to reduce component complexity
 * and enable reuse across dashboard/analytics
 */

import {
  IconRefresh,
  IconTrendingDown,
  IconRocket,
} from "@tabler/icons-react";
import { ThemeIcon } from "@mantine/core";

/**
 * Format days since last use into human-readable string
 * @param {number} days - Number of days
 * @returns {string} - Formatted string (e.g., "2 years, 3 months", "5 days")
 */
export function formatDaysAway(days) {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const yearText = `${years} year${years > 1 ? 's' : ''}`;
    const monthText = months > 0 ? `, ${months} month${months > 1 ? 's' : ''}` : '';
    return `${yearText}${monthText}`;
  }

  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }

  return `${days} day${days > 1 ? 's' : ''}`;
}

/**
 * Get appropriate icon for recalibration based on days away
 * @param {number} daysSinceLastUse - Days since last use
 * @returns {JSX.Element} - ThemeIcon component
 */
export function getRecalibrationIcon(daysSinceLastUse) {
  if (daysSinceLastUse >= 365) {
    return (
      <ThemeIcon
        size={80}
        radius="xl"
        variant="gradient"
        gradient={{ from: "orange", to: "red" }}
      >
        <IconTrendingDown size={40} />
      </ThemeIcon>
    );
  }

  if (daysSinceLastUse >= 90) {
    return (
      <ThemeIcon
        size={80}
        radius="xl"
        variant="gradient"
        gradient={{ from: "blue", to: "purple" }}
      >
        <IconRefresh size={40} />
      </ThemeIcon>
    );
  }

  return (
    <ThemeIcon
      size={80}
      radius="xl"
      variant="gradient"
      gradient={{ from: "teal", to: "lime" }}
    >
      <IconRocket size={40} />
    </ThemeIcon>
  );
}

/**
 * Get gradient colors for recalibration type
 * @param {string} type - Recalibration type
 * @returns {object} - Gradient configuration
 */
export function getRecalibrationGradient(type) {
  switch (type) {
    case 'major_recal':
      return { from: "orange", to: "red" };
    case 'moderate_recal':
      return { from: "blue", to: "purple" };
    case 'gentle_recal':
    default:
      return { from: "teal", to: "lime" };
  }
}

/**
 * Get title text for recalibration modal
 * @param {string} type - Recalibration type
 * @returns {string} - Modal title
 */
export function getRecalibrationTitle(type) {
  if (type === 'major_recal') {
    return "Long Time, No See!";
  }
  return "Welcome Back!";
}

/**
 * Get badge color for recalibration type
 * @param {string} type - Recalibration type
 * @returns {string} - Mantine color name
 */
export function getRecalibrationBadgeColor(type) {
  if (type === 'major_recal') {
    return 'orange';
  }
  return 'blue';
}
