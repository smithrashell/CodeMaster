import React, { useState, useEffect, useCallback } from "react";
import StrategyService from "../../services/strategyService";

/**
 * TagStrategyGrid Component
 * 
 * Displays problem tags in a 3-column grid layout with inline strategy hints.
 * Only one tag's strategy can be expanded at a time, appearing directly below 
 * the tag's row. Replaces the separate ExpandablePrimerSection.
 */
const TagStrategyGrid = ({ problemTags, className = "" }) => {
  const [expandedTag, setExpandedTag] = useState(null);
  const [strategies, setStrategies] = useState({});
  const [loading, setLoading] = useState(false);

  // DEBUG: Log what tags we're receiving
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("🏷️ TagStrategyGrid received problemTags:", problemTags);
    // eslint-disable-next-line no-console
    console.log("🏷️ TagStrategyGrid tags length:", problemTags?.length);
    // eslint-disable-next-line no-console
    console.log("🏷️ TagStrategyGrid tags type:", typeof problemTags);
  }, [problemTags]);

  useEffect(() => {
    if (problemTags && problemTags.length > 0) {
      // eslint-disable-next-line no-console
      console.log("🏷️ TagStrategyGrid: Loading strategies for tags:", problemTags);
      loadStrategies();
    } else {
      // eslint-disable-next-line no-console
      console.log("🏷️ TagStrategyGrid: No tags to load strategies for");
    }
  }, [problemTags, loadStrategies]);

  const loadStrategies = useCallback(async () => {
    try {
      setLoading(true);
      
      // Normalize tags to lowercase to match strategy data
      const normalizedTags = problemTags.map((tag) => tag.toLowerCase().trim());
      
      // Use optimized parallel processing from StrategyService
      const tagPrimers = await StrategyService.getTagPrimers(normalizedTags);
      
      // Convert array to object with tag names as keys
      const strategiesMap = {};
      tagPrimers.forEach((primer) => {
        strategiesMap[primer.tag] = primer;
      });
      
      setStrategies(strategiesMap);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error loading strategies:", err);
    } finally {
      setLoading(false);
    }
  }, [problemTags]);

  const handleTagClick = (tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    
    // Toggle expansion: if same tag clicked, collapse; if different tag, expand new one
    if (expandedTag === normalizedTag) {
      // Clean up expanded class when collapsing
      const hintElement = document.querySelector('.tag-strategy-hint');
      if (hintElement) {
        hintElement.classList.remove('expanded');
      }
      setExpandedTag(null);
    } else {
      setExpandedTag(normalizedTag);
      
      // Smart scrolling to prevent content blocking
      setTimeout(() => {
        const hintElement = document.querySelector('.tag-strategy-hint');
        const sidebarContent = document.querySelector('.cd-sidenav.problem-sidebar-view .cd-sidenav__content');
        const expandedButton = document.querySelector('.tag-strategy-button-expanded');
        const problemCard = document.querySelector('.problem-sidebar-card');
        
        if (hintElement && sidebarContent && expandedButton) {
          // Add expanded class for CSS animations
          hintElement.classList.add('expanded');
          
          // Wait for the hint element to render and get its actual height
          setTimeout(() => {
            const buttonRect = expandedButton.getBoundingClientRect();
            const sidebarRect = sidebarContent.getBoundingClientRect();
            const hintRect = hintElement.getBoundingClientRect();
            const problemCardRect = problemCard ? problemCard.getBoundingClientRect() : null;
            const scrollTop = sidebarContent.scrollTop;
            
            // Calculate the total height needed for tag button + expanded content
            const expandedContentHeight = hintRect.height;
            const safeMargin = 20; // Extra breathing room
            
            // Strategy 1: Ensure problem card remains fully visible
            if (problemCardRect) {
              const problemCardBottom = problemCardRect.bottom;
              const buttonTop = buttonRect.top;
              
              // If the expanded content would overlap with problem card
              if (buttonTop < problemCardBottom + safeMargin) {
                // Scroll so that the expanded button starts right after the problem card
                const targetPosition = problemCardRect.height + scrollTop + safeMargin;
                
                sidebarContent.scrollTo({
                  top: Math.max(0, targetPosition),
                  behavior: 'smooth'
                });
                return;
              }
            }
            
            // Strategy 2: Use scrollIntoView for better automatic positioning
            const expandedTagContainer = expandedButton.closest('.tag-strategy-container');
            if (expandedTagContainer) {
              expandedTagContainer.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
              });
              return;
            }
            
            // Strategy 3: Fallback - Position button with consideration for expanded content
            const currentRelativePosition = buttonRect.top - sidebarRect.top;
            const minTopPosition = 80; // Minimum distance from top to ensure content visibility
            
            // Check if current position would cause content to overflow or block other content
            if (currentRelativePosition < minTopPosition || 
                (currentRelativePosition + expandedContentHeight) > (sidebarRect.height - safeMargin)) {
              
              // Calculate position that ensures both button and expanded content are visible
              const idealPosition = Math.min(
                minTopPosition,
                sidebarRect.height - expandedContentHeight - safeMargin
              );
              
              const targetPosition = buttonRect.top - sidebarRect.top + scrollTop - idealPosition;
              
              sidebarContent.scrollTo({
                top: Math.max(0, targetPosition),
                behavior: 'smooth'
              });
            }
          }, 50); // Wait for hint element to fully render
        }
      }, 100);
    }
  };

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

  const renderStrategyHint = () => {
    if (!expandedTag || loading) {
      return null;
    }

    const strategy = strategies[expandedTag];
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
      <div className="tag-strategy-hint expanded">
        <div className="tag-strategy-hint-content">
          <div className="tag-strategy-hint-header">
            <span className="tag-strategy-hint-title">
              {strategy.tag.charAt(0).toUpperCase() + strategy.tag.slice(1)} Strategy
            </span>
          </div>
          
          {strategy.strategy && (
            <div className="tag-strategy-hint-body">
              {strategy.strategy}
            </div>
          )}
          
          {strategy.patterns && strategy.patterns.length > 0 && (
            <div className="tag-strategy-hint-patterns">
              <div className="tag-strategy-hint-patterns-title">Key Patterns:</div>
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

  if (!problemTags || problemTags.length === 0) {
    // eslint-disable-next-line no-console
    console.log("🏷️ TagStrategyGrid: Rendering 'No tags available' message");
    return (
      <div className={`problem-sidebar-section ${className}`}>
        <div className="problem-sidebar-section-header">
          <span className="problem-sidebar-section-title">Tags</span>
        </div>
        <span className="problem-sidebar-no-tags">No tags available</span>
      </div>
    );
  }

  // eslint-disable-next-line no-console
  console.log("🏷️ TagStrategyGrid: Rendering with tags:", problemTags);

  const expandedRowIndex = getExpandedTagRowIndex();

  return (
    <div className={`problem-sidebar-section tag-strategy-container ${className}`}>
      <div className="problem-sidebar-section-header">
        <span className="problem-sidebar-section-title">
          Tags {Object.keys(strategies).length > 0 && `(${Object.keys(strategies).length} strategies)`}
        </span>
      </div>
      
      <div className="tag-strategy-simple-grid">
        {problemTags.map((tag, index) => {
          const normalizedTag = tag.toLowerCase().trim();
          const isExpanded = expandedTag === normalizedTag;
          const currentRowIndex = getTagRowIndex(index);
          const isLastInRow = index % 2 === 1 || index === problemTags.length - 1;
          const showHintAfterThisRow = isLastInRow && expandedRowIndex === currentRowIndex;
          
          return (
            <React.Fragment key={index}>
              <button
                className={`tag-strategy-button ${isExpanded ? 'tag-strategy-button-expanded' : ''}`}
                onClick={() => handleTagClick(tag)}
                type="button"
                aria-expanded={isExpanded}
                aria-label={`Toggle strategy for ${tag} tag`}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </button>
              
              {/* Show expanded strategy content after the row containing the expanded tag */}
              {showHintAfterThisRow && expandedTag && renderStrategyHint()}
            </React.Fragment>
          );
        })}
        
        {loading && (
          <div className="tag-strategy-loading">
            Loading strategies...
          </div>
        )}
      </div>
    </div>
  );
};

export default TagStrategyGrid;