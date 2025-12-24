import React, {
  useMemo,
  useEffect,
} from "react";
import SmartPopover from './SmartPopover.jsx';
import { useFloatingHintState } from '../../hooks/useFloatingHintState.js';
import { useHintThemeColors } from '../../hooks/useHintThemeColors.js';
import { useStrategy } from '../../../shared/hooks/useStrategy.js';
import { useFloatingHintLogic } from '../../hooks/useFloatingHintLogic.js';
import { useFloatingHintHandlers } from '../../hooks/useFloatingHintHandlers.js';
import FloatingHintButtonCore from './FloatingHintButtonCore.jsx';
import FloatingHintPopoverContent from './FloatingHintPopoverContent.jsx';
import { calculateInterviewRestrictions, getButtonStyles } from './floatingHintHelpers.js';

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
  forceOpen = false,
}) {
  // Use the original hooks
  const {
    opened,
    setOpened,
    expandedHints,
    setExpandedHints,
    buttonRef,
    hintsUsed,
    setHintsUsed
  } = useFloatingHintState();

  // Handle external force open trigger
  useEffect(() => {
    if (forceOpen && !opened) {
      setOpened(true);
      if (onOpen) onOpen();
    }
  }, [forceOpen, opened, setOpened, onOpen]);
  
  const colors = useHintThemeColors();
  
  // Use the shared strategy hook
  const { hints, loading, error } = useStrategy(problemTags);
  
  // Calculate interview restrictions
  const interviewRestrictions = useMemo(() => 
    calculateInterviewRestrictions(interviewConfig, sessionType, hintsUsed),
    [interviewConfig, sessionType, hintsUsed]
  );
  
  // Use custom hook for complex business logic
  const {
    contextualHints,
    generalHints,
    toggleHintExpansion,
    getHintId
  } = useFloatingHintLogic({
    hints,
    expandedHints,
    setExpandedHints,
    interviewRestrictions,
    setHintsUsed,
    problemId,
    problemTags,
    opened,
    onHintClick
  });

  // Use custom hook for event handlers
  const {
    handlePopoverClose,
    handleButtonClick
  } = useFloatingHintHandlers({
    opened,
    setOpened,
    onOpen,
    onClose,
    problemTags,
    hints,
    expandedHints,
    buttonRef,
    popoverWidth: uiMode === 'minimal-clean' ? 300 : 350
  });
  
  const buttonStyles = useMemo(() => 
    getButtonStyles(uiMode, interviewRestrictions),
    [uiMode, interviewRestrictions]
  );
  const totalHints = hints.length;


  // Don't render if no tags or if hints are completely disabled in interview mode
  if (problemTags.length === 0 || !interviewRestrictions.hintsAllowed) {
    return null;
  }

  return (
    <>
      <FloatingHintButtonCore
        buttonRef={buttonRef}
        handleButtonClick={handleButtonClick}
        buttonStyles={buttonStyles}
        interviewRestrictions={interviewRestrictions}
        totalHints={totalHints}
        problemTags={problemTags}
        opened={opened}
      />
      
      <SmartPopover
        opened={opened}
        onClose={handlePopoverClose}
        target={buttonRef.current}
        width={uiMode === 'minimal-clean' ? 300 : 350}
        maxHeight={400}
        colors={colors}
      >
        <FloatingHintPopoverContent
          loading={loading}
          error={error}
          hints={hints}
          colors={colors}
          problemTags={problemTags}
          interviewRestrictions={interviewRestrictions}
          generalHints={generalHints}
          contextualHints={contextualHints}
          expandedHints={expandedHints}
          toggleHintExpansion={toggleHintExpansion}
          onHintClick={onHintClick}
          getHintId={getHintId}
        />
      </SmartPopover>
    </>
  );
}

export default FloatingHintButton;
