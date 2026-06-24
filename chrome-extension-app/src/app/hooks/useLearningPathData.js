import { useState, useEffect } from "react";
import { debug } from "../../shared/utils/logging/logger.js";

const TIER_ORDER = ["Core Concept", "Fundamental Technique", "Advanced Technique"];
const TIER_LABELS = { "Core Concept": "Core Concepts", "Fundamental Technique": "Fundamentals", "Advanced Technique": "Advanced" };

const extract = (appState, key) =>
  appState?.[key] || appState?.mastery?.[key] || appState?.learningState?.[key] || [];

const computeProgress = (item) => {
  const recentResults = item.recent_results;
  if (Array.isArray(recentResults) && recentResults.length > 0) {
    return Math.round((recentResults.filter(Boolean).length / recentResults.length) * 100);
  }
  const total = item.total_attempts ?? item.totalAttempts ?? 0;
  const success = item.successful_attempts ?? item.successfulAttempts ?? 0;
  return total > 0 ? Math.round((success / total) * 100) : 0;
};

const enrichTag = (item, isFocus) => {
  const totalAttempts = item.total_attempts ?? item.totalAttempts ?? 0;
  const status = item.mastered ? 'mastered'
    : totalAttempts > 0 ? 'learning'
    : isFocus ? 'available' : 'not-started';
  return { ...item, isFocus, progress: Math.min(computeProgress(item), 100), status };
};

export const useLearningPathData = (appState) => {
  const [flowData, setFlowData] = useState(null);

  useEffect(() => {
    if (!appState) return;

    const masteryData = extract(appState, 'masteryData');
    const focusTags = extract(appState, 'focusTags');
    const allTagsInTier = extract(appState, 'allTagsInCurrentTier');
    const masteredTagNames = extract(appState, 'masteredTags');
    const currentTier = appState?.currentTier || appState?.classification || "Core Concept";

    const masteryMap = new Map(masteryData.map(m => [m.tag, m]));
    const focusSet = new Set(focusTags);
    const masteredSet = new Set(masteredTagNames);

    const mastered = [];
    const focus = [];
    const upNext = [];

    for (const tagName of allTagsInTier) {
      const item = masteryMap.get(tagName);
      const isFocus = focusSet.has(tagName);

      if (masteredSet.has(tagName)) {
        mastered.push(enrichTag(item || { tag: tagName, mastered: true, total_attempts: 0 }, false));
      } else if (isFocus) {
        focus.push(enrichTag(item || { tag: tagName, mastered: false, total_attempts: 0 }, true));
      } else {
        const enriched = enrichTag(item || { tag: tagName, mastered: false, total_attempts: 0 }, false);
        upNext.push(enriched);
      }
    }

    upNext.sort((a, b) => b.progress - a.progress);

    const tierProgress = {
      mastered: mastered.length,
      total: allTagsInTier.length,
      percentage: allTagsInTier.length > 0 ? Math.round((mastered.length / allTagsInTier.length) * 100) : 0
    };

    const currentIdx = TIER_ORDER.indexOf(currentTier);
    const tiers = TIER_ORDER.map((name, idx) => ({
      name,
      label: TIER_LABELS[name],
      isCurrent: idx === currentIdx,
      isCompleted: idx < currentIdx,
      isLocked: idx > currentIdx
    }));

    debug("Learning Path flow", { currentTier, mastered: mastered.length, focus: focus.length, upNext: upNext.length });

    const tagMeta = appState?.tagMeta || {};

    setFlowData({ currentTier, tierProgress, tiers, columns: { mastered, focus, upNext }, tagMeta });
  }, [appState]);

  return flowData;
};
