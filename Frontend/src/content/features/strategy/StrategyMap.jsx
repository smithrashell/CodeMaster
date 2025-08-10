import React, { useState, useEffect } from "react";
import Header from "../../components/navigation/header";

const StrategyMap = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTiers, setExpandedTiers] = useState(new Set());
  const [tierData, setTierData] = useState({});
  const [focusTags, setFocusTags] = useState([]);
  const [currentTier, setCurrentTier] = useState("Core Concept");

  useEffect(() => {
    const fetchStrategyMapData = () => {
      setLoading(true);
      chrome.runtime.sendMessage({ type: "getStrategyMapData" }, (response) => {
        if (response && response.status === "success") {
          const data = response.data;
          console.log("🗺️ Strategy Map data:", data);

          setTierData(data.tierData || {});
          setFocusTags(data.focusTags || []);
          setCurrentTier(data.currentTier || "Core Concept");
          setError(null);
        } else {
          console.error("❌ Failed to get Strategy Map data:", response?.error);
          setError("Failed to load strategy map data. Please try refreshing.");

          // Fallback to empty data structure
          setTierData({});
          setFocusTags([]);
          setCurrentTier("Core Concept");
        }
        setLoading(false);
      });
    };

    fetchStrategyMapData();
  }, []);

  // Helper function to format tag name for display
  const formatTagName = (tag) => {
    return tag.replace(/-/g, " ").toLowerCase();
  };

  // Helper function to get tag class based on status
  const getTagClass = (mastery, unlocked, isFocus) => {
    if (isFocus) return "cm-strategy-focus-tag";
    if (!unlocked) return "cm-strategy-locked-tag";
    if (mastery >= 0.8) return "cm-strategy-mastered-tag";
    if (mastery >= 0.3) return "cm-strategy-learning-tag";
    return "cm-strategy-available-tag";
  };

  // Get visible tags based on tier expand state
  const getVisibleTags = (tags, tierName) => {
    if (expandedTiers.has(tierName)) return tags;
    return tags.slice(0, 3); // Show first 3 tags when collapsed
  };

  // Toggle tier expansion
  const toggleTierExpansion = (tierName) => {
    const newExpandedTiers = new Set(expandedTiers);
    if (newExpandedTiers.has(tierName)) {
      newExpandedTiers.delete(tierName);
    } else {
      newExpandedTiers.add(tierName);
    }
    setExpandedTiers(newExpandedTiers);
  };

  if (loading) {
    return (
      <div id="cm-mySidenav" className="cm-sidenav">
        <Header title="Strategy Map" />
        <div className="cm-sidenav__content">
          <div className="cm-stats-loading">
            <p>Loading strategy map...</p>
            <div className="cm-loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="cm-mySidenav" className="cm-sidenav">
        <Header title="Strategy Map" />
        <div className="cm-sidenav__content">
          <div className="cm-stats-error">
            <p>⚠️ {error}</p>
            <button
              className="cm-retry-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="cm-mySidenav" className="cm-sidenav">
      <Header title="Strategy Map" />
      <div className="cm-sidenav__content">
        <div style={{ padding: "8px 12px" }}>
          {/* Current Tier Status */}
          <div
            style={{
              padding: "6px",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              borderRadius: "4px",
              marginBottom: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--cm-text)",
              }}
            >
              Current Tier: {currentTier}
            </div>
          </div>

          {/* Focus Tags Section */}
          {focusTags.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--cm-text)",
                  marginBottom: "6px",
                }}
              >
                Focus Tags
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {focusTags.map((tag) => {
                  const tagData = Object.values(tierData)
                    .flat()
                    .find((t) => t.tag === tag);
                  return (
                    <span
                      key={tag}
                      className="cm-extension cd-strategy-focus-tag"
                    >
                      {formatTagName(tag)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Tiers */}
          {Object.entries(tierData).map(([tierName, tags]) => (
            <div key={tierName} style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--cm-text)",
                  marginBottom: "6px",
                }}
              >
                {tierName}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {getVisibleTags(tags, tierName).map((tagData) => {
                  const isFocus = focusTags.includes(tagData.tag);
                  const tagClass = getTagClass(
                    tagData.mastery,
                    tagData.unlocked,
                    isFocus
                  );

                  return (
                    <span
                      key={tagData.tag}
                      className={`cm-extension ${tagClass}`}
                      style={{
                        cursor: tagData.unlocked ? "pointer" : "default",
                      }}
                      title={`${formatTagName(tagData.tag)} - ${
                        isFocus
                          ? "Focus Tag"
                          : !tagData.unlocked
                          ? "Locked"
                          : tagData.mastery === 0
                          ? "Not Started"
                          : tagData.mastery >= 0.8
                          ? "Mastered"
                          : "Learning"
                      }`}
                    >
                      {formatTagName(tagData.tag)}
                    </span>
                  );
                })}
                {!expandedTiers.has(tierName) && tags.length > 3 && (
                  <span
                    onClick={() => toggleTierExpansion(tierName)}
                    style={{
                      fontSize: "10px",
                      color: "var(--cm-link)",
                      opacity: 0.8,
                      padding: "2px 6px",
                      fontWeight: "500",
                      cursor: "pointer",
                      borderRadius: "4px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.opacity = "1";
                      e.target.style.backgroundColor =
                        "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.opacity = "0.8";
                      e.target.style.backgroundColor = "transparent";
                    }}
                    title={`Click to show all ${tags.length} tags`}
                  >
                    +{tags.length - 3} more
                  </span>
                )}
                {expandedTiers.has(tierName) && tags.length > 3 && (
                  <span
                    onClick={() => toggleTierExpansion(tierName)}
                    style={{
                      fontSize: "10px",
                      color: "var(--cm-link)",
                      opacity: 0.8,
                      padding: "2px 6px",
                      fontWeight: "500",
                      cursor: "pointer",
                      borderRadius: "4px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.opacity = "1";
                      e.target.style.backgroundColor =
                        "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.opacity = "0.8";
                      e.target.style.backgroundColor = "transparent";
                    }}
                    title="Click to show less"
                  >
                    show less
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {Object.entries(tierData).length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: "var(--cm-text)",
                opacity: 0.7,
              }}
            >
              <p>🏗️ Setting up your strategy map...</p>
              <p style={{ fontSize: "12px", marginTop: "8px" }}>
                Start solving problems to see your progress!
              </p>
            </div>
          )}

          {/* Legend - only show when any tier is expanded */}
          {expandedTiers.size > 0 && (
            <div
              style={{
                marginTop: "12px",
                padding: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--cm-text)",
                  opacity: 0.8,
                  marginBottom: "4px",
                  fontWeight: "500",
                }}
              >
                Legend:
              </div>
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--cm-text)",
                  opacity: 0.7,
                  lineHeight: "1.3",
                }}
              >
                Focus • Mastered • Learning • Available • Locked
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyMap;
