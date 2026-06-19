import logger from "../../../shared/utils/logging/logger.js";
import React, { useState, useCallback } from "react";
import { useStrategy } from "../../../shared/hooks/useStrategy";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/chromeAPIErrorHandler.js";

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

const TagButton = ({
  tag,
  isExpanded,
  primersAvailable,
  primersEncouraged,
  sessionType,
  onTagClick,
  canExpandMore
}) => {
  // Disable if primers not available, OR if limit reached and not already expanded
  const isDisabled = !primersAvailable || (!canExpandMore && !isExpanded);
  const isLimitReached = primersAvailable && !canExpandMore && !isExpanded;

  return (
    <button
      className={`tag-strategy-button ${
        isExpanded
          ? "tag-strategy-button-expanded tag-strategy-no-hover"
          : ""
      } ${isDisabled ? "tag-strategy-disabled" : ""}`}
      onClick={() => onTagClick(tag)}
      type="button"
      aria-expanded={isExpanded}
      aria-label={!primersAvailable
        ? `${tag} tag - strategies disabled in interview mode`
        : isLimitReached
          ? `${tag} tag - strategy limit reached`
          : `Toggle strategy for ${tag} tag`}
      disabled={isDisabled}
      title={!primersAvailable
        ? `Strategies are not available in ${sessionType} mode`
        : isLimitReached
          ? "Strategy limit reached"
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
        ...(isDisabled
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
};

const TagSectionHeader = ({ strategiesCount, isInterviewMode, primersAvailable, strategiesRemaining, maxStrategies }) => (
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
      {isInterviewMode && primersAvailable && maxStrategies !== null && (
        <span
          className="interview-constraint-indicator"
          style={{
            fontSize: "10px",
            color: strategiesRemaining === 0 ? "var(--cm-error, #f44336)" : "var(--cm-warning, #f59e0b)",
            marginLeft: "5px",
            fontWeight: "normal"
          }}
        >
          • {strategiesRemaining === 0 ? "Strategy limit reached" : `${strategiesRemaining} strateg${strategiesRemaining === 1 ? 'y' : 'ies'} remaining`}
        </span>
      )}
    </span>
  </div>
);

const useStrategyLoader = (problemTags) => {
  const { primers, loading } = useStrategy(problemTags);
  const strategies = primers.reduce((acc, primer) => {
    if (primer && primer.tag) {
      acc[primer.tag] = primer;
    }
    return acc;
  }, {});
  return { strategies, loading };
};

const useScrollManagement = () => {
  const ensureProblemCardVisibility = useCallback((problemCardRect, buttonRect, scrollTop, sidebarContent, safeMargin) => {
    if (buttonRect.top < problemCardRect.bottom + safeMargin) {
      sidebarContent.scrollTo({ top: Math.max(0, problemCardRect.height + scrollTop + safeMargin), behavior: "smooth" });
      return true;
    }
    return false;
  }, []);

  const handleExpandedContainerScrolling = useCallback((expandedButton, actionButtons, hintRect) => {
    const container = expandedButton.closest(".tag-strategy-container");
    if (!container || !actionButtons) return false;
    const wouldOverflow = container.getBoundingClientRect().bottom + hintRect.height > actionButtons.getBoundingClientRect().top - 20;
    container.scrollIntoView({ behavior: "smooth", block: wouldOverflow ? "center" : "start", inline: "nearest" });
    return true;
  }, []);

  const handleFallbackScrolling = useCallback(({ buttonRect, sidebarRect, hintRect, scrollTop, sidebarContent, safeMargin }) => {
    const relPos = buttonRect.top - sidebarRect.top;
    const contentHeight = hintRect.height;
    if (relPos < 80 || relPos + contentHeight > sidebarRect.height - safeMargin) {
      const idealPos = Math.min(80, sidebarRect.height - contentHeight - safeMargin);
      sidebarContent.scrollTo({ top: Math.max(0, relPos + scrollTop - idealPos), behavior: "smooth" });
    }
  }, []);

  return {
    ensureProblemCardVisibility,
    handleExpandedContainerScrolling,
    handleFallbackScrolling
  };
};

const createScrollingHandler = (scrollManagement) => () => {
  setTimeout(() => {
    const hint = document.querySelector(".tag-strategy-hint");
    const sidebar = document.querySelector(".cm-sidenav.problem-sidebar-view .cm-sidenav__content");
    const btn = document.querySelector(".tag-strategy-button-expanded");
    const problemCard = document.querySelector(".problem-sidebar-card");
    const actionBtns = document.querySelector(".problem-sidebar-actions");
    if (!hint || !sidebar || !btn) return;
    hint.classList.add("expanded");
    setTimeout(() => {
      const btnRect = btn.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      const hintRect = hint.getBoundingClientRect();
      const pcRect = problemCard ? problemCard.getBoundingClientRect() : null;
      const { ensureProblemCardVisibility, handleExpandedContainerScrolling, handleFallbackScrolling } = scrollManagement;
      if (pcRect && ensureProblemCardVisibility(pcRect, btnRect, sidebar.scrollTop, sidebar, 20)) return;
      if (handleExpandedContainerScrolling(btn, actionBtns, hintRect)) return;
      handleFallbackScrolling({ buttonRect: btnRect, sidebarRect, hintRect, scrollTop: sidebar.scrollTop, sidebarContent: sidebar, safeMargin: 20 });
    }, 50);
  }, 100);
};

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

const DEFAULT_STRATEGY_LIMITS = {
  'standard': null,        // unlimited
  'interview-like': 2,     // same as hints limit
  'full-interview': 0      // none allowed
};

const getInterviewModeConfig = (sessionType, interviewConfig, strategiesUsed = 0) => {
  const isInterviewMode = sessionType && sessionType !== 'standard';
  const primersAvailable = !isInterviewMode || (interviewConfig?.primers?.available !== false);
  const primersEncouraged = !isInterviewMode || (interviewConfig?.primers?.encouraged !== false);

  // Get max strategies: use config value if available, otherwise fall back to defaults
  const configMax = interviewConfig?.primers?.max;
  const maxStrategies = configMax !== undefined ? configMax : (DEFAULT_STRATEGY_LIMITS[sessionType] ?? null);

  const strategiesRemaining = maxStrategies === null ? null : Math.max(0, maxStrategies - strategiesUsed);
  const canExpandMore = maxStrategies === null || strategiesUsed < maxStrategies;

  return { isInterviewMode, primersAvailable, primersEncouraged, maxStrategies, strategiesRemaining, canExpandMore };
};

const createTagClickHandler = ({ expandedTag, setExpandedTag, interviewState, problemId, scrollManagement, onStrategyUsed }) => {
  return async (tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    const isExpanding = expandedTag !== normalizedTag;

    // Check interview mode constraints
    if (isExpanding && !interviewState.primersAvailable) {
      logger.info(`🚫 Tag Strategy: Primers not available in ${interviewState.sessionType} mode`);
      return; // Block expansion in interview modes that don't allow primers
    }

    // Check strategy usage limit (only for NEW expansions, not re-expanding same tag)
    if (isExpanding && !interviewState.canExpandMore) {
      logger.info(`🚫 Tag Strategy: Strategy limit reached (${interviewState.maxStrategies} max)`);
      return; // Block expansion when limit reached
    }

    logger.info(`🏷️ Tag Strategy: ${isExpanding ? 'Expanded' : 'Collapsed'} "${tag}" strategy`);

    // Track interaction and increment usage counter when expanding a NEW strategy
    if (isExpanding) {
      await trackHintInteraction(tag, problemId);
      // Increment usage counter for interview mode tracking
      if (onStrategyUsed) {
        onStrategyUsed();
      }
    }

    // Create scrolling handler with access to scroll management functions
    const scrollingHandler = createScrollingHandler(scrollManagement);

    // Toggle expansion: if same tag clicked, collapse; if different tag, expand new one
    handleTagToggle(expandedTag, normalizedTag, setExpandedTag, scrollingHandler);
  };
};

const renderNoTagsMessage = (className) => {
  return (
    <div className={`problem-sidebar-section ${className}`}>
      <div className="problem-sidebar-section-header">
        <span className="problem-sidebar-section-title">Tags</span>
      </div>
      <span className="problem-sidebar-no-tags">No tags available</span>
    </div>
  );
};

function TagStrategyGrid({
  problemTags,
  problemId,
  className = "",
  interviewConfig = null,
  sessionType = null
}) {
  const [expandedTag, setExpandedTag] = useState(null);
  const [strategiesUsed, setStrategiesUsed] = useState(0);

  const { isInterviewMode, primersAvailable, primersEncouraged, maxStrategies, strategiesRemaining, canExpandMore } = getInterviewModeConfig(sessionType, interviewConfig, strategiesUsed);

  const { strategies, loading } = useStrategyLoader(problemTags);
  const {
    ensureProblemCardVisibility,
    handleExpandedContainerScrolling,
    handleFallbackScrolling
  } = useScrollManagement();

  if (isInterviewMode && !primersAvailable) {
    return null;
  }

  const onStrategyUsed = () => {
    setStrategiesUsed(prev => prev + 1);
  };

  const handleTagClick = createTagClickHandler({
    expandedTag,
    setExpandedTag,
    interviewState: { primersAvailable, sessionType, canExpandMore, maxStrategies },
    problemId,
    scrollManagement: { ensureProblemCardVisibility, handleExpandedContainerScrolling, handleFallbackScrolling },
    onStrategyUsed
  });

  const getTagRowIndex = (tagIndex) => Math.floor(tagIndex / 2);

  const getExpandedTagRowIndex = () => {
    if (!expandedTag) return -1;
    const idx = problemTags.findIndex((tag) => tag.toLowerCase().trim() === expandedTag);
    return idx !== -1 ? getTagRowIndex(idx) : -1;
  };

  if (!problemTags || problemTags.length === 0) {
    return renderNoTagsMessage(className);
  }

  const expandedRowIndex = getExpandedTagRowIndex();

  return (
    <div id="tour-tag-strategy-section" className={`problem-sidebar-section tag-strategy-container ${className}`}>
      <TagSectionHeader
        strategiesCount={Object.keys(strategies).length}
        isInterviewMode={isInterviewMode}
        primersAvailable={primersAvailable}
        strategiesRemaining={strategiesRemaining}
        maxStrategies={maxStrategies}
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
                canExpandMore={canExpandMore}
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
