import { useMemo } from 'react';
import { useFloatingHintState } from './useFloatingHintState.js';
import { useHintThemeColors } from './useHintThemeColors.js';
import { useFloatingHintLogic } from './useFloatingHintLogic.js';
import { 
  calculateInterviewRestrictions,
  getButtonStyles,
  getPopoverDropdownStyles,
  createKeyDownHandler,
  createPopoverContentProps
} from '../components/strategy/floatingHintHelpers.js';

/**
 * Custom hook to manage all state and computed values for FloatingHintButton
 * Extracted to reduce main component line count
 */
export function useFloatingHintButtonState({
  problemTags,
  problemId,
  onClose,
  onOpen,
  onHintClick,
  interviewConfig,
  sessionType,
  uiMode
}) {
  // Base state hooks
  const floatingHintState = useFloatingHintState();
  const themeColors = useHintThemeColors();
  const colors = themeColors;
  
  const {
    hints,
    setHints,
    loading,
    setLoading,
    error,
    setError,
    opened,
    setOpened,
    expandedHints,
    setExpandedHints,
    hintsUsed,
    setHintsUsed,
    buttonRef
  } = floatingHintState;

  // Memoize interview restrictions to prevent re-renders
  const interviewRestrictions = useMemo(() => 
    calculateInterviewRestrictions(interviewConfig, sessionType, hintsUsed),
    [interviewConfig, sessionType, hintsUsed]
  );

  // Use custom hook for hint logic
  const hintLogic = useFloatingHintLogic({
    problemTags,
    problemId,
    onClose,
    onOpen,
    onHintClick,
    hints,
    setHints,
    setLoading,
    setError,
    opened,
    setOpened,
    expandedHints,
    setExpandedHints,
    hintsUsed,
    setHintsUsed,
    interviewRestrictions
  });

  // Memoize styles and handlers
  const buttonStyles = useMemo(() => 
    getButtonStyles(uiMode, interviewRestrictions),
    [uiMode, interviewRestrictions]
  );

  const popoverStyles = useMemo(() => 
    getPopoverDropdownStyles(colors),
    [colors]
  );

  const keyDownHandler = useMemo(() => 
    createKeyDownHandler(hintLogic.handleButtonClick),
    [hintLogic.handleButtonClick]
  );

  const popoverContentProps = useMemo(() => 
    createPopoverContentProps({
      loading,
      error,
      hints,
      colors,
      problemTags,
      interviewRestrictions,
      generalHints: hintLogic.generalHints,
      contextualHints: hintLogic.contextualHints,
      expandedHints,
      toggleHintExpansion: hintLogic.toggleHintExpansion,
      onHintClick,
      getHintId: hintLogic.getHintId
    }),
    [loading, error, hints, colors, problemTags, interviewRestrictions, hintLogic.generalHints, hintLogic.contextualHints, expandedHints, hintLogic.toggleHintExpansion, onHintClick, hintLogic.getHintId]
  );

  return {
    // State values
    colors,
    opened,
    buttonRef,
    interviewRestrictions,
    totalHints: hintLogic.totalHints,
    
    // Event handlers
    handlePopoverClose: hintLogic.handlePopoverClose,
    handleButtonClick: hintLogic.handleButtonClick,
    keyDownHandler,
    
    // Memoized objects
    buttonStyles,
    popoverStyles,
    popoverContentProps
  };
}