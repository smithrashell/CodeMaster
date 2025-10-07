/**
 * Custom hook for FloatingHintButton event handlers
 * Extracts event handling logic to reduce main component size
 */
import { useCallback } from 'react';
import { calculatePopoverPosition } from '../components/strategy/floatingHintHelpers.js';

export const useFloatingHintHandlers = ({
  opened,
  setOpened,
  onOpen,
  onClose,
  problemTags,
  hints,
  expandedHints,
  buttonRef,
  popoverWidth
}) => {
  // Handle popover close
  const handlePopoverClose = useCallback(() => {
    setOpened(false);
    if (onClose) {
      onClose({ 
        problemTags,
        hintsCount: hints.length,
        expandedHintsCount: expandedHints.size,
        timestamp: new Date().toISOString(),
      });
    }
  }, [onClose, problemTags, hints.length, expandedHints.size, setOpened]);

  // Handle button click
  const handleButtonClick = useCallback(() => {
    const newOpened = !opened;
    setOpened(newOpened);
    
    // Calculate and set popover position when opening
    if (newOpened) {
      // Use setTimeout to ensure DOM is updated before calculating position
      setTimeout(() => {
        calculatePopoverPosition(buttonRef, popoverWidth, 8);
      }, 0);
      
      if (onOpen) {
        onOpen({
          problemTags,
          hintsCount: hints.length,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [opened, onOpen, problemTags, hints.length, setOpened, buttonRef, popoverWidth]);

  return {
    handlePopoverClose,
    handleButtonClick
  };
};