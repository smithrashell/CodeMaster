import React from "react";
import Badge from '../ui/Badge.jsx';
import { getBadgeColor, getBadgeText } from './floatingHintHelpers.js';

/**
 * HintBadge - Small notification badge showing hint count or interview restrictions
 */
function HintBadge({ totalHints, interviewRestrictions }) {
  if (totalHints === 0 && !interviewRestrictions.isInterviewMode) {
    return null;
  }

  return (
    <Badge
      size="xs"
      variant="filled"
      color={getBadgeColor(interviewRestrictions)}
      style={{
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        padding: 0,
        fontSize: "9px",
        lineHeight: "16px",
      }}
    >
      {getBadgeText(interviewRestrictions, totalHints)}
    </Badge>
  );
}

export default HintBadge;