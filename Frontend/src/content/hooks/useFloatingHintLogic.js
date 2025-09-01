/**
 * Custom hook for FloatingHintButton logic
 */
import { useCallback, useMemo, useEffect } from "react";
import StrategyService from "../services/strategyService";
import { HintInteractionService } from "../../shared/services/hintInteractionService";
import { createHintClickData } from "../components/strategy/floatingHintHelpers";

// Helper function to filter hints by type
const filterHintsByType = (hints) => {
  const general = hints.filter(
    (hint) => hint.type === "general" || hint.type === "pattern"
  );
  const contextual = hints.filter((hint) => hint.type === "contextual");

  return {
    generalHints: general,
    contextualHints: contextual,
    totalHints: hints.length,
  };
};

// Helper function to create close event data
const createCloseEventData = (problemTags, hintsCount) => ({
  problemTags,
  hintsCount,
  timestamp: new Date().toISOString(),
});

// Helper function to create open event data
const createOpenEventData = (problemTags, hintsCount) => ({
  problemTags,
  hintsCount,
  timestamp: new Date().toISOString(),
});

// Helper function to update hint expansion state
const updateHintExpansion = (
  expandedHints, 
  hintId, 
  isCurrentlyExpanded, 
  interviewRestrictions, 
  setHintsUsed
) => {
  const newSet = new Set(expandedHints);
  if (isCurrentlyExpanded) {
    newSet.delete(hintId);
  } else {
    newSet.add(hintId);
    if (interviewRestrictions.isInterviewMode) {
      setHintsUsed(prevUsed => prevUsed + 1);
    }
  }
  return newSet;
};

export const useFloatingHintLogic = ({
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
  _hintsUsed,
  setHintsUsed,
  interviewRestrictions
}) => {
  // Load contextual hints when problem tags change
  const tagsString = useMemo(() => JSON.stringify(problemTags), [problemTags]);

  const loadHints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const contextualHints = await StrategyService.getContextualHints(problemTags);
      setHints(contextualHints);
    } catch (err) {
      console.error("❌ Error loading hints in FloatingHintButton:", err);
      setError("Failed to load strategy hints");
    } finally {
      setLoading(false);
    }
  }, [problemTags, setHints, setLoading, setError]);

  useEffect(() => {
    if (problemTags.length > 0) {
      loadHints();
    } else {
      setHints([]);
    }
  }, [tagsString, loadHints, setHints, problemTags.length]);

  // Memoize expensive hint filtering calculations
  const { generalHints, contextualHints, totalHints } = useMemo(() => 
    filterHintsByType(hints), [hints]);

  // Memoize callback functions
  const handlePopoverClose = useCallback(() => {
    setOpened(false);
    // Reset expanded hints when popover closes
    setExpandedHints(new Set());
    if (onClose) {
      onClose(createCloseEventData(problemTags, hints.length));
    }
  }, [onClose, problemTags, hints.length, setExpandedHints, setOpened]);

  const handleButtonClick = useCallback(() => {
    const newOpened = !opened;
    setOpened(newOpened);
    if (newOpened && onOpen) {
      onOpen(createOpenEventData(problemTags, hints.length));
    }
  }, [opened, onOpen, problemTags, hints.length, setOpened]);

  // Handle hint expand/collapse toggle
  const toggleHintExpansion = useCallback(
    async (hintId, hint, index, hintType) => {
      const isCurrentlyExpanded = expandedHints.has(hintId);

      // Check interview restrictions before expanding hints
      if (!isCurrentlyExpanded && !interviewRestrictions.hintsAvailable) {
        return;
      }

      setExpandedHints((prev) => 
        updateHintExpansion(prev, hintId, isCurrentlyExpanded, interviewRestrictions, setHintsUsed)
      );

      // Track the expand/collapse action
      const hintClickData = createHintClickData({
        problemId, hintId, hintType, hint, problemTags, isCurrentlyExpanded, 
        opened, hints, expandedHints, index
      });

      // Save interaction to persistent storage
      try {
        await HintInteractionService.saveHintInteraction(hintClickData, {
          totalHints: hints.length,
        });
      } catch (error) {
        console.warn("Failed to save hint interaction:", error);
      }

      if (onHintClick) {
        onHintClick(hintClickData);
      }
    },
    [expandedHints, onHintClick, problemTags, hints, opened, interviewRestrictions, problemId, setExpandedHints, setHintsUsed]
  );

  // Generate a unique hint ID
  const getHintId = useCallback((hint, index, hintType) => {
    return `${hintType}-${hint.primaryTag}-${
      hint.relatedTag || "general"
    }-${index}`;
  }, []);

  return {
    generalHints,
    contextualHints,
    totalHints,
    handlePopoverClose,
    handleButtonClick,
    toggleHintExpansion,
    getHintId
  };
};