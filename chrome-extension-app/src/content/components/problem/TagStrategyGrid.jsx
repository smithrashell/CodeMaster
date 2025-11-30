import logger from "../../../shared/utils/logging/logger.js";
import React, { useState, useCallback } from "react";
import { useStrategy } from "../../../shared/hooks/useStrategy";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";

// Strategy hint content component
const StrategyHintContent = ({ strategy }) => {
  if (!strategy) {
    return (
      <div className="tag-strategy-hint expanded">
        <div className="tag-strategy-hint-content">
          <div className="tag-strategy-hint-empty">
            No strategy information available for this tag
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="tour-strategy-dropdown" className="tag-strategy-hint expanded">
      <div className="tag-strategy-hint-content">
        <div className="tag-strategy-hint-header">
          <span className="tag-strategy-hint-title">
            {strategy.tag.charAt(0).toUpperCase() + strategy.tag.slice(1)}{" "}
            Strategy
          </span>
        </div>

        {strategy.strategy && (
          <div className="tag-strategy-hint-body">{strategy.strategy}</div>
        )}

        {strategy.patterns && strategy.patterns.length > 0 && (
          <div className="tag-strategy-hint-patterns">
            <div className="tag-strategy-hint-patterns-title">
              Key Patterns:
            </div>
            <div className="tag-strategy-hint-patterns-list">
              {strategy.patterns.slice(0, 3).map((pattern, index) => (
                <span key={index} className="tag-strategy-hint-pattern">
                  {pattern}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Tag button component
const TagButton = ({ 
  tag, 
  isExpanded, 
  primersAvailable, 
  primersEncouraged, 
  sessionType, 
  onTagClick 
}) => (
  <button
    className={`tag-strategy-button ${
      isExpanded
        ? "tag-strategy-button-expanded tag-strategy-no-hover"
        : ""
    } ${!primersAvailable ? "tag-strategy-disabled" : ""}`}
    onClick={() => onTagClick(tag)}
    type="button"
    aria-expanded={isExpanded}
    aria-label={primersAvailable 
      ? `Toggle strategy for ${tag} tag` 
      : `${tag} tag - strategies disabled in interview mode`}
    disabled={!primersAvailable}
    title={!primersAvailable 
      ? `Strategies are not available in ${sessionType} mode` 
      : `Click to view ${tag} strategy`}
    style={{
      ...(isExpanded
        ? {
            backgroundColor: "var(--cm-dropdown-bg)",
            color: "var(--cm-text)",
            borderRadius: "10px 10px 0px 0px",
            margin: "0px",
            border: "none",
          }
        : {}),
      ...((!primersAvailable)
        ? {
            opacity: 0.6,
            cursor: "not-allowed",
            backgroundColor: "var(--cm-disabled-bg, #f5f5f5)",
            color: "var(--cm-disabled-text, #999)"
          }
        : {})
    }}
  >
    {tag.charAt(0).toUpperCase() + tag.slice(1)}
    {!primersAvailable && !primersEncouraged && (
      <span style={{ marginLeft: "4px", fontSize: "10px" }}>🚫</span>
    )}
  </button>
);

// Section header component
const TagSectionHeader = ({ strategiesCount, isInterviewMode, primersAvailable }) => (
  <div className="problem-sidebar-section-header">
    <span className="problem-sidebar-section-title">
      Tags{" "}
      {strategiesCount > 0 &&
        `(${strategiesCount} strategies)`}
      {isInterviewMode && !primersAvailable && (
        <span 
          className="interview-constraint-indicator"
          style={{
            fontSize: "10px",
            color: "var(--cm-error, #f44336)",
            marginLeft: "5px",
            fontWeight: "normal"
          }}
        >
          • Strategies disabled in interview mode
        </span>
      )}
    </span>
  </div>
);

// Consolidated strategy loader using existing useStrategy hook
const useStrategyLoader = (problemTags) => {
  logger.info("🏷️ useStrategyLoader: Received problemTags:", problemTags);
  
  const { primers, loading } = useStrategy(problemTags);
  
  logger.info("🏷️ useStrategyLoader: Got primers from useStrategy:", primers);
  logger.info("🏷️ useStrategyLoader: Loading state:", loading);
  
  // Convert array to object with tag names as keys to match expected interface
  const strategies = primers.reduce((acc, primer) => {
    if (primer && primer.tag) {
      acc[primer.tag] = primer;
      logger.info(`🏷️ useStrategyLoader: Added strategy for "${primer.tag}":`, primer);
    } else {
      logger.warn("🏷️ useStrategyLoader: Invalid primer:", primer);
    }
    return acc;
  }, {});

  logger.info("🏷️ useStrategyLoader: Final strategies object:", strategies);
  logger.info("🏷️ useStrategyLoader: Strategy count:", Object.keys(strategies).length);

  return { strategies, loading };
};

// Custom hook for scroll management
const useScrollManagement = () => {
  // Helper function for Strategy 1: Ensure problem card remains fully visible
  const ensureProblemCardVisibility = useCallback((problemCardRect, buttonRect, scrollTop, sidebarContent, safeMargin) => {
    const problemCardBottom = problemCardRect.bottom;
    const buttonTop = buttonRect.top;

    // If the expanded content would overlap with problem card
    if (buttonTop < problemCardBottom + safeMargin) {
      // Scroll so that the expanded button starts right after the problem card
      const targetPosition = problemCardRect.height + scrollTop + safeMargin;

      sidebarContent.scrollTo({
        top: Math.max(0, targetPosition),
        behavior: "smooth",
      });
      return true;
    }
    return false;
  }, []);

  // Helper function for Strategy 2: Enhanced scrollIntoView with action button protection
  const handleExpandedContainerScrolling = useCallback((expandedButton, actionButtons, hintRect) => {
    const expandedTagContainer = expandedButton.closest(".tag-strategy-container");
    if (expandedTagContainer && actionButtons) {
      // Calculate if we need to ensure action buttons remain visible
      const containerRect = expandedTagContainer.getBoundingClientRect();
      const actionButtonsRect = actionButtons.getBoundingClientRect();
      const expandedContentHeight = hintRect.height;
      
      // If expanded content would push action buttons out of view
      if (containerRect.bottom + expandedContentHeight > actionButtonsRect.top - 20) {
        // Scroll to position the container higher to keep action buttons visible
        expandedTagContainer.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      } else {
        expandedTagContainer.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      }
      return true;
    }
    return false;
  }, []);

  // Helper function for Strategy 3: Fallback positioning
  const handleFallbackScrolling = useCallback(({ buttonRect, sidebarRect, hintRect, scrollTop, sidebarContent, safeMargin }) => {
    const currentRelativePosition = buttonRect.top - sidebarRect.top;
    const minTopPosition = 80; // Minimum distance from top to ensure content visibility
    const expandedContentHeight = hintRect.height;

    // Check if current position would cause content to overflow or block other content
    if (
      currentRelativePosition < minTopPosition ||
      currentRelativePosition + expandedContentHeight > sidebarRect.height - safeMargin
    ) {
      // Calculate position that ensures both button and expanded content are visible
      const idealPosition = Math.min(
        minTopPosition,
        sidebarRect.height - expandedContentHeight - safeMargin
      );

      const targetPosition = buttonRect.top - sidebarRect.top + scrollTop - idealPosition;

      sidebarContent.scrollTo({
        top: Math.max(0, targetPosition),
        behavior: "smooth",
      });
    }
  }, []);

  return {
    ensureProblemCardVisibility,
    handleExpandedContainerScrolling,
    handleFallbackScrolling
  };
};

// Helper function to create scrolling handler after tag expansion
const createScrollingHandler = (scrollManagement) => () => {
  setTimeout(() => {
    const hintElement = document.querySelector(".tag-strategy-hint");
    const sidebarContent = document.querySelector(
      ".cm-sidenav.problem-sidebar-view .cm-sidenav__content"
    );
    const expandedButton = document.querySelector(
      ".tag-strategy-button-expanded"
    );
    const problemCard = document.querySelector(".problem-sidebar-card");
    const actionButtons = document.querySelector(".problem-sidebar-actions");

    if (hintElement && sidebarContent && expandedButton) {
      // Add expanded class for CSS animations
      hintElement.classList.add("expanded");

      // Wait for the hint element to render and get its actual height
      setTimeout(() => {
        const buttonRect = expandedButton.getBoundingClientRect();
        const sidebarRect = sidebarContent.getBoundingClientRect();
        const hintRect = hintElement.getBoundingClientRect();
        const problemCardRect = problemCard ? problemCard.getBoundingClientRect() : null;
        const scrollTop = sidebarContent.scrollTop;
        const safeMargin = 20; // Extra breathing room

        // Try each scrolling strategy in order
        const { ensureProblemCardVisibility, handleExpandedContainerScrolling, handleFallbackScrolling } = scrollManagement;
        
        if (problemCardRect && ensureProblemCardVisibility(problemCardRect, buttonRect, scrollTop, sidebarContent, safeMargin)) {
          return;
        }
        
        if (handleExpandedContainerScrolling(expandedButton, actionButtons, hintRect)) {
          return;
        }
        
        handleFallbackScrolling({ buttonRect, sidebarRect, hintRect, scrollTop, sidebarContent, safeMargin });
      }, 50); // Wait for hint element to fully render
    }
  }, 100);
};

// Helper function to track hint interaction
const trackHintInteraction = async (tag, problemId) => {
  const normalizedTag = tag.toLowerCase().trim();
  logger.info(`🏷️ Tracking tag strategy view: ${tag}`, { problemId });
  
  // Validate problemId before sending
  if (!problemId) {
    logger.warn("🏷️ No problemId provided for hint interaction, skipping tracking");
    return;
  }
  
  try {
    await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "saveHintInteraction",
      interactionData: {
        problemId: problemId,
        hintType: "primer", 
        primaryTag: normalizedTag,
        content: `Viewed strategy for ${tag} tag`,
        action: "expand",
        sessionContext: {
          componentType: "TagStrategyGrid",
          expandedTag: normalizedTag
        }
      }
    });
  } catch (error) {
    logger.warn("Failed to track tag strategy view:", error);
  }
};

// Helper function to handle tag expansion/collapse logic
const handleTagToggle = (expandedTag, normalizedTag, setExpandedTag, scrollingHandler) => {
  if (expandedTag === normalizedTag) {
    // Clean up expanded class when collapsing
    const hintElement = document.querySelector(".tag-strategy-hint");
    if (hintElement) {
      hintElement.classList.remove("expanded");
    }
    setExpandedTag(null);
  } else {
    setExpandedTag(normalizedTag);
    // Enhanced scrolling to ensure content visibility
    scrollingHandler();
  }
};

// Helper function to calculate interview mode configuration
const getInterviewModeConfig = (sessionType, interviewConfig) => {
  const isInterviewMode = sessionType && sessionType !== 'standard';
  const primersAvailable = !isInterviewMode || (interviewConfig?.primers?.available !== false);
  const primersEncouraged = !isInterviewMode || (interviewConfig?.primers?.encouraged !== false);
  
  return { isInterviewMode, primersAvailable, primersEncouraged };
};

// Helper function to create tag click handler
const createTagClickHandler = (expandedTag, setExpandedTag, interviewState, problemId, scrollManagement) => {
  return async (tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    const isExpanding = expandedTag !== normalizedTag;
    
    // Check interview mode constraints
    if (isExpanding && !interviewState.primersAvailable) {
      logger.info(`🚫 Tag Strategy: Primers not available in ${interviewState.sessionType} mode`);
      return; // Block expansion in interview modes that don't allow primers
    }
    
    logger.info(`🏷️ Tag Strategy: ${isExpanding ? 'Expanded' : 'Collapsed'} "${tag}" strategy`);

    // Track interaction when expanding strategy
    if (isExpanding) {
      await trackHintInteraction(tag, problemId);
    }

    // Create scrolling handler with access to scroll management functions
    const scrollingHandler = createScrollingHandler(scrollManagement);

    // Toggle expansion: if same tag clicked, collapse; if different tag, expand new one
    handleTagToggle(expandedTag, normalizedTag, setExpandedTag, scrollingHandler);
  };
};

// Helper function to render "no tags" message
const renderNoTagsMessage = (className) => {
  logger.info("🏷️ TagStrategyGrid: Rendering 'No tags available' message");
  return (
    <div className={`problem-sidebar-section ${className}`}>
      <div className="problem-sidebar-section-header">
        <span className="problem-sidebar-section-title">Tags</span>
      </div>
      <span className="problem-sidebar-no-tags">No tags available</span>
    </div>
  );
};

/**
 * TagStrategyGrid Component
 *
 * Displays problem tags in a 3-column grid layout with inline strategy hints.
 * Only one tag's strategy can be expanded at a time, appearing directly below
 * the tag's row. Replaces the separate ExpandablePrimerSection.
 * 
 * Interview mode aware: respects interview constraints for primer/strategy access.
 */
function TagStrategyGrid({ 
  problemTags, 
  problemId, 
  className = "",
  interviewConfig = null,
  sessionType = null 
}) {
  const [expandedTag, setExpandedTag] = useState(null);

  logger.info("🏷️ TagStrategyGrid: Render started", {
    problemTags,
    problemId,
    problemIdType: typeof problemId,
    problemIdValue: problemId,
    sessionType,
    interviewConfig
  });

  // Interview mode logic
  const { isInterviewMode, primersAvailable, primersEncouraged } = getInterviewModeConfig(sessionType, interviewConfig);

  logger.info("🏷️ TagStrategyGrid: Interview mode settings", {
    isInterviewMode,
    primersAvailable,
    primersEncouraged
  });

  // Use custom hooks
  const { strategies, loading } = useStrategyLoader(problemTags);
  
  logger.info("🏷️ TagStrategyGrid: After useStrategyLoader", {
    strategiesCount: Object.keys(strategies).length,
    strategiesKeys: Object.keys(strategies),
    loading,
    strategies
  });
  const {
    ensureProblemCardVisibility,
    handleExpandedContainerScrolling,
    handleFallbackScrolling
  } = useScrollManagement();

  // Create tag click handler using extracted helper
  const handleTagClick = createTagClickHandler(
    expandedTag,
    setExpandedTag,
    { primersAvailable, sessionType },
    problemId,
    { ensureProblemCardVisibility, handleExpandedContainerScrolling, handleFallbackScrolling }
  );

  const getTagRowIndex = (tagIndex) => {
    return Math.floor(tagIndex / 2);
  };

  const getExpandedTagRowIndex = () => {
    if (!expandedTag) return -1;
    const expandedTagIndex = problemTags.findIndex(
      (tag) => tag.toLowerCase().trim() === expandedTag
    );
    return expandedTagIndex !== -1 ? getTagRowIndex(expandedTagIndex) : -1;
  };


  // Strategy hint rendering now handled by StrategyHintContent component

  if (!problemTags || problemTags.length === 0) {
    return renderNoTagsMessage(className);
  }

  // Render strategy grid with available tags

  const expandedRowIndex = getExpandedTagRowIndex();

  return (
    <div id="tour-tag-strategy-section" className={`problem-sidebar-section tag-strategy-container ${className}`}>
      <TagSectionHeader 
        strategiesCount={Object.keys(strategies).length}
        isInterviewMode={isInterviewMode}
        primersAvailable={primersAvailable}
      />

      <div className="tag-strategy-simple-grid">
        {problemTags.map((tag, index) => {
          const normalizedTag = tag.toLowerCase().trim();
          const isExpanded = expandedTag === normalizedTag;
          const currentRowIndex = getTagRowIndex(index);
          const isLastInRow = index % 2 === 1 || index === problemTags.length - 1;
          const showHintAfterThisRow = isLastInRow && expandedRowIndex === currentRowIndex;

          return (
            <React.Fragment key={index}>
              <TagButton
                tag={tag}
                isExpanded={isExpanded}
                primersAvailable={primersAvailable}
                primersEncouraged={primersEncouraged}
                sessionType={sessionType}
                onTagClick={handleTagClick}
              />

              {/* Show expanded strategy content after the row containing the expanded tag */}
              {showHintAfterThisRow && expandedTag && (
                <StrategyHintContent strategy={strategies[expandedTag]} />
              )}
            </React.Fragment>
          );
        })}

        {loading && (
          <div className="tag-strategy-loading">Loading strategies...</div>
        )}
      </div>
    </div>
  );
}

export default TagStrategyGrid;
