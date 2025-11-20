/**
 * Action handlers for FloatingHelpButton
 *
 * Extracted to reduce component complexity
 */

import { IconBug, IconQuestionMark, IconBook } from "@tabler/icons-react";

/**
 * Menu items configuration
 */
export const HELP_MENU_ITEMS = [
  { icon: IconBug, label: "Report a Bug", action: "reportBug" },
  { icon: IconQuestionMark, label: "View FAQ & Help", action: "viewFAQ" },
  { icon: IconBook, label: "Documentation", action: "viewDocs" },
];

/**
 * Open URL in new secure window
 */
const openSecureWindow = (url) => {
  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (newWindow) newWindow.opener = null;
};

/**
 * Handle Report Bug action
 */
export const handleReportBug = (onClose) => {
  const repoUrl = "https://github.com/smithrashell/CodeMaster";
  const issueUrl = `${repoUrl}/issues/new?template=bug_report.md`;
  openSecureWindow(issueUrl);
  onClose();
};

/**
 * Handle View FAQ action
 */
export const handleViewFAQ = (onClose) => {
  const dashboardUrl = chrome.runtime.getURL("app.html#/help");
  openSecureWindow(dashboardUrl);
  onClose();
};

/**
 * Handle View Docs action
 */
export const handleViewDocs = (onClose) => {
  const docsUrl = "https://github.com/smithrashell/CodeMaster/blob/main/README.md";
  openSecureWindow(docsUrl);
  onClose();
};

/**
 * Execute action by name
 */
export const executeHelpAction = (action, onClose) => {
  const actions = {
    reportBug: () => handleReportBug(onClose),
    viewFAQ: () => handleViewFAQ(onClose),
    viewDocs: () => handleViewDocs(onClose),
  };
  actions[action]?.();
};
