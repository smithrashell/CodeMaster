/**
 * Custom hook for FloatingHintButton business logic
 * Extracts complex logic to reduce main component size
 */
import { useMemo, useCallback } from 'react';
import { HintInteractionService } from '../../shared/services/hintInteractionService';
import { createHintClickData } from '../components/strategy/floatingHintHelpers.js';

export const useFloatingHintLogic = ({
  hints,
  expandedHints,
  setExpandedHints,
  interviewRestrictions,
  setHintsUsed,
  problemId,
  problemTags,
  opened,
  onHintClick
}) => {
  // Filter hints by type
  const { contextualHints, generalHints } = useMemo(() => {
    console.log("💡 FloatingHintButton: Filtering hints from useStrategy:", {
      totalHints: hints.length,
      hintsTypes: hints.map(h => ({ type: h.type, primaryTag: h.primaryTag, relatedTag: h.relatedTag })),
      uniqueTypes: [...new Set(hints.map(h => h.type))]
    });
    
    const contextual = hints.filter(hint => hint.type === "contextual");
    const general = hints.filter(hint => hint.type === "general" || hint.type === "pattern");
    
    console.log("💡 FloatingHintButton: After filtering:", {
      contextualCount: contextual.length,
      generalCount: general.length,
      contextualTypes: contextual.map(h => h.type),
      generalTypes: general.map(h => h.type)
    });
    
    return {
      contextualHints: contextual,
      generalHints: general
    };
  }, [hints]);

  // Handle hint expand/collapse toggle
  const toggleHintExpansion = useCallback(
    async (hintId, hint, index, hintType) => {
      const isCurrentlyExpanded = expandedHints.has(hintId);

      // Check interview restrictions before expanding hints
      if (!isCurrentlyExpanded && !interviewRestrictions.hintsAvailable) {
        return;
      }

      setExpandedHints((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyExpanded) {
          newSet.delete(hintId);
        } else {
          newSet.add(hintId);
          if (interviewRestrictions.isInterviewMode) {
            setHintsUsed(prevUsed => prevUsed + 1);
          }
        }
        return newSet;
      });

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
    contextualHints,
    generalHints,
    toggleHintExpansion,
    getHintId
  };
};