import React from "react";
import {
  Tooltip,
  Popover,
} from "@mantine/core";
import { IconBulb } from "@tabler/icons-react";
import { useFloatingHintButtonState } from '../../hooks/useFloatingHintButtonState.js';
import FloatingHintPopoverContent from './FloatingHintPopoverContent.jsx';
import {
  getTooltipLabel,
  getAriaLabel,
  handleMouseEnter,
  handleMouseLeave
} from './floatingHintHelpers.js';
import HintBadge from './HintBadge.jsx';

/**
 * FloatingHintButton - Compact floating button that shows strategy hints in a popover
 * Better UX than inline panel - doesn't take up space until needed
 */
function FloatingHintButton({
  problemTags = [],
  problemId = null,
  onOpen,
  onClose,
  onHintClick,
  interviewConfig = null,
  sessionType = null,
  uiMode = 'full-support',
}) {
  // Use consolidated state hook
  const {
    opened,
    buttonRef,
    interviewRestrictions,
    totalHints,
    handlePopoverClose,
    handleButtonClick,
    keyDownHandler,
    buttonStyles,
    popoverStyles,
    popoverContentProps
  } = useFloatingHintButtonState({
    problemTags,
    problemId,
    onClose,
    onOpen,
    onHintClick,
    interviewConfig,
    sessionType,
    uiMode
  });

  // Don't render if no tags or if hints are completely disabled in interview mode
  if (problemTags.length === 0 || !interviewRestrictions.hintsAllowed) {
    return null;
  }

  return (
    <Popover
      opened={opened}
      onClose={handlePopoverClose}
      width={uiMode === 'minimal-clean' ? 300 : 350}
      position="bottom"
      withArrow
      withinPortal
      shadow={uiMode === 'minimal-clean' ? "sm" : "md"}
      styles={popoverStyles}
    >
      <Popover.Target>
        <Tooltip
          label={getTooltipLabel(interviewRestrictions, totalHints)}
          position="top"
        >
          <button
            ref={buttonRef}
            onClick={handleButtonClick}
            style={buttonStyles}
            aria-label={getAriaLabel(interviewRestrictions, totalHints, problemTags)}
            aria-expanded={opened}
            aria-haspopup="dialog"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onKeyDown={keyDownHandler}
          >
            <IconBulb size={16} color="white" />
            <HintBadge 
              totalHints={totalHints} 
              interviewRestrictions={interviewRestrictions} 
            />
          </button>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <FloatingHintPopoverContent {...popoverContentProps} />
      </Popover.Dropdown>
    </Popover>
  );
}

export default FloatingHintButton;
