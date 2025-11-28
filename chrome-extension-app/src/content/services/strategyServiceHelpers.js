/**
 * Strategy Service Helpers - Constants, Utilities, and Private Methods
 */

import logger from "../../shared/utils/logger.js";

// Fallback strategy data when database is unavailable
export const FALLBACK_STRATEGIES = {
  array: {
    tag: "array",
    strategy:
      "Consider using two pointers, sliding window, or divide and conquer approaches.",
    overview:
      "Arrays are fundamental data structures for storing sequential data.",
    patterns: ["Two Pointers", "Sliding Window", "Binary Search"],
    related: ["sorting", "hash table"],
  },
  "hash table": {
    tag: "hash table",
    strategy:
      "Use hash maps for O(1) lookups and to track frequency or existence of elements.",
    overview:
      "Hash tables provide constant-time access for key-value relationships.",
    patterns: ["Frequency Count", "Lookup Table", "Memoization"],
    related: ["array", "string"],
  },
  sorting: {
    tag: "sorting",
    strategy: "Sort first to enable two pointers or binary search approaches.",
    overview: "Sorting can simplify many problems by creating order.",
    patterns: ["Merge Sort", "Quick Sort", "Bucket Sort"],
    related: ["array", "greedy"],
  },
  string: {
    tag: "string",
    strategy:
      "Consider sliding window, two pointers, or character frequency approaches.",
    overview:
      "String manipulation often involves pattern matching and character analysis.",
    patterns: ["Sliding Window", "Two Pointers", "Pattern Matching"],
    related: ["hash table", "dynamic programming"],
  },
  tree: {
    tag: "tree",
    strategy:
      "Use DFS for path problems, BFS for level-order, and consider tree properties.",
    overview:
      "Trees are hierarchical data structures with parent-child relationships.",
    patterns: ["DFS", "BFS", "Tree Traversal"],
    related: ["depth-first search", "breadth-first search"],
  },
};

// Hint selection configuration
export const HINT_CONFIG = {
  MAX_HINTS: 4,
  TIER_WEIGHTS: {
    essential: 300,
    strong: 200,
    meaningful: 100,
  },
  HINT_DISTRIBUTION: {
    essential: { min: 1, max: 3 },
    strong: { min: 0, max: 2 },
    meaningful: { min: 0, max: 1 },
  },
  DIFFICULTY_CONFIG: {
    Easy: {
      maxHints: 3,
      preferredTypes: ["pattern", "general"],
      complexityBonus: 0,
      tierWeights: { essential: 300, strong: 150, meaningful: 50 },
    },
    Medium: {
      maxHints: 4,
      preferredTypes: ["contextual", "pattern", "general"],
      complexityBonus: 50,
      tierWeights: { essential: 300, strong: 200, meaningful: 100 },
    },
    Hard: {
      maxHints: 4,
      preferredTypes: ["contextual", "optimization"],
      complexityBonus: 100,
      tierWeights: { essential: 350, strong: 250, meaningful: 150 },
    },
  },
};

// Common tags for cache pre-warming
export const COMMON_TAGS = [
  "array",
  "hash table",
  "string",
  "sorting",
  "tree",
  "dynamic programming",
];

/**
 * Helper function to create contextual hints for multi-tag combinations
 */
export function createContextualHints(primaryTag, strategyData, problemTags) {
  const contextualHints = [];

  if (strategyData.strategies && problemTags.length > 1) {
    for (const strategyEntry of strategyData.strategies) {
      if (problemTags.includes(strategyEntry.when)) {
        contextualHints.push({
          type: 'contextual',
          primaryTag: primaryTag,
          relatedTag: strategyEntry.when,
          tip: strategyEntry.tip,
          relevance: 1.5
        });
      }
    }
  }

  return contextualHints;
}

/**
 * Create normalized tag pair key to prevent duplicates
 */
export function createNormalizedTagPair(tag1, tag2) {
  return [tag1, tag2].sort().join("+");
}

/**
 * Extract key technique/approach from strategy text
 */
export function extractKeyword(strategy) {
  const keywords = [
    "hash map",
    "hash table",
    "two pointers",
    "sliding window",
    "binary search",
    "DFS",
    "BFS",
    "dynamic programming",
    "backtracking",
    "greedy",
    "sort",
    "divide and conquer",
    "recursion",
    "iteration",
    "stack",
    "queue",
  ];

  const lowerStrategy = strategy.toLowerCase();
  for (const keyword of keywords) {
    if (lowerStrategy.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }

  return "systematic approach";
}

// Contextual combinations for multi-tag strategies
export const CONTEXTUAL_COMBINATIONS = {
  "array+hash table":
    "Use an array to iterate through elements and a hash table to store indices or frequencies for O(1) lookups. This combination is powerful for two-sum style problems.",
  "array+two pointers":
    "Sort the array first, then use two pointers from opposite ends. This approach works well for finding pairs or subarrays that meet specific criteria.",
  "string+hash table":
    "Use a hash table to track character frequencies or positions while iterating through the string. Perfect for anagram detection and substring problems.",
  "tree+depth-first search":
    "Apply DFS traversal on tree nodes to explore all paths from root to leaves. Use recursion to handle subtree operations naturally.",
  "tree+breadth-first search":
    "Use BFS with a queue to process tree nodes level by level. Ideal for finding shortest paths or level-order operations.",
  "dynamic programming+array":
    "Use array indices to represent subproblem states in your DP solution. Each array element stores the optimal solution for that substate.",
  "sliding window+string":
    "Maintain a sliding window over the string and use hash table to track characters in current window. Adjust window size based on problem constraints.",
  "binary search+array":
    "Take advantage of sorted array properties to eliminate half the search space in each iteration. Perfect for finding targets or insertion points.",
  "greedy+sorting":
    "Sort first to enable greedy choices. Process elements in order to make locally optimal decisions that lead to global optimum.",
  "backtracking+tree":
    "Use tree structure to represent decision space. Backtrack when current path cannot lead to valid solution.",
};

/**
 * Generate contextual hint by combining strategies from two related tags
 */
export function generateContextualTip(primaryTag, relatedTag, primaryStrategy, relatedStrategy) {
  const combinationKey1 = `${primaryTag}+${relatedTag}`;
  const combinationKey2 = `${relatedTag}+${primaryTag}`;

  const contextualTip =
    CONTEXTUAL_COMBINATIONS[combinationKey1] ||
    CONTEXTUAL_COMBINATIONS[combinationKey2];

  if (contextualTip) {
    return { tip: contextualTip, quality: 2.0 };
  }

  const primaryKeyword = extractKeyword(primaryStrategy.strategy);
  const relatedKeyword = extractKeyword(relatedStrategy.strategy);

  const genericTip = `Combine ${primaryTag} techniques with ${relatedTag} patterns. Consider using ${primaryKeyword} alongside ${relatedKeyword} for an optimal solution approach.`;

  return { tip: genericTip, quality: 1.0 };
}

/**
 * Extract strategy text from strategy object
 */
export function extractStrategyText(tag, strategy) {
  let strategyText = null;
  let debugSource = '';

  logger.info(`🚨 INTENSIVE DEBUG: Raw strategy object for "${tag}":`, strategy);

  if (!strategy) {
    debugSource = 'no_strategy_object';
    logger.warn(`🚨 INTENSIVE DEBUG: No strategy object found for "${tag}"`);
  } else if (strategy && strategy.strategy) {
    strategyText = strategy.strategy;
    debugSource = 'strategy.strategy';
    logger.info(`🚨 INTENSIVE DEBUG: Using strategy.strategy for "${tag}": "${strategyText.substring(0, 50)}..."`);
  } else if (strategy && strategy.overview) {
    strategyText = strategy.overview;
    debugSource = 'strategy.overview';
    logger.info(`🚨 INTENSIVE DEBUG: Using strategy.overview for "${tag}": "${strategyText.substring(0, 50)}..."`);
  } else if (typeof strategy === 'string') {
    strategyText = strategy;
    debugSource = 'strategy_is_string';
    logger.info(`🚨 INTENSIVE DEBUG: Strategy is string for "${tag}": "${strategyText.substring(0, 50)}..."`);
  } else {
    debugSource = 'no_valid_text_property';
    logger.warn(`🚨 INTENSIVE DEBUG: Strategy object exists but no valid text property for "${tag}". Available props:`, Object.keys(strategy));
  }

  return { strategyText, debugSource };
}

/**
 * Adds a contextual hint if both strategies are valid
 */
export function addContextualHintIfValid(primaryTag, relatedTag, strategiesData, hints) {
  const primaryStrategy = strategiesData[primaryTag];
  const relatedStrategy = strategiesData[relatedTag];

  if (!primaryStrategy || !relatedStrategy) {
    return;
  }

  const contextualResult = generateContextualTip(
    primaryTag,
    relatedTag,
    primaryStrategy,
    relatedStrategy
  );

  const contextualHint = {
    type: "contextual",
    primaryTag,
    relatedTag,
    tip: contextualResult.tip,
    tier: "essential",
    source: "multi-tag-contextual",
    complexity: 2,
    relevance: 1.0 + (contextualResult.quality * 0.2),
    relationshipScore: contextualResult.quality / 2.0,
    finalScore: 300 + (contextualResult.quality * 50),
    chainPosition: hints.length + 1,
  };

  hints.push(contextualHint);
  logger.info(
    `✅ HINT DEBUG: Added contextual hint for "${primaryTag}" + "${relatedTag}":`,
    contextualHint
  );
}

/**
 * Process contextual hints for multi-tag combinations
 */
export function processContextualHints(problemTags, strategiesData, hints) {
  try {
    logger.info(
      `🔍 HINT DEBUG: Creating contextual hints for ${problemTags.length} tags`
    );

    const processedCombinations = new Set();

    for (let i = 0; i < problemTags.length; i++) {
      for (let j = i + 1; j < problemTags.length; j++) {
        const primaryTag = problemTags[i];
        const relatedTag = problemTags[j];

        const normalizedKey = createNormalizedTagPair(primaryTag, relatedTag);

        if (processedCombinations.has(normalizedKey)) {
          logger.info(`🔄 HINT DEBUG: Skipping duplicate combination: ${normalizedKey}`);
          continue;
        }

        processedCombinations.add(normalizedKey);
        logger.info(`🔍 HINT DEBUG: Processing contextual pair: ${primaryTag} + ${relatedTag} (normalized: ${normalizedKey})`);

        try {
          addContextualHintIfValid(primaryTag, relatedTag, strategiesData, hints);
          logger.info(`✅ HINT DEBUG: Contextual pair processed successfully`);
        } catch (contextError) {
          logger.error(`❌ HINT DEBUG: Error in contextual hint creation:`, {
            primaryTag,
            relatedTag,
            error: contextError.message,
            stack: contextError.stack
          });
          continue;
        }
      }
    }
  } catch (contextualSectionError) {
    logger.error(`❌ HINT DEBUG: Error in entire contextual hints section:`, {
      error: contextualSectionError.message,
      stack: contextualSectionError.stack
    });
  }
}

/**
 * Process a general hint for a single tag
 */
export function processGeneralHintForTag(tag, strategiesData, hints) {
  logger.info(`🔍 HINT DEBUG: Processing tag "${tag}" for general hint`);

  const strategy = strategiesData[tag];

  logger.info(`📊 HINT DEBUG: Strategy data for "${tag}":`, {
    hasStrategy: !!strategy,
    strategyType: typeof strategy,
    strategyKeys: strategy ? Object.keys(strategy) : [],
    hasStrategyProperty: !!(strategy && strategy.strategy),
    strategyContent: strategy && strategy.strategy ? strategy.strategy.substring(0, 100) + '...' : 'N/A',
    fullStrategyStructure: strategy ? JSON.stringify(strategy, null, 2) : null
  });

  const { strategyText, debugSource } = extractStrategyText(tag, strategy);

  if (strategyText) {
    const generalHint = {
      type: "general",
      primaryTag: tag,
      relatedTag: null,
      tip: strategyText,
      tier: "essential",
      source: "strategy",
      complexity: 1,
      relevance: 1.0,
      finalScore: 300,
      chainPosition: hints.length + 1,
    };

    hints.push(generalHint);
    logger.info(
      `✅ INTENSIVE DEBUG: Added general hint for "${tag}" using source: ${debugSource}`,
      { generalHint, strategyTextLength: strategyText.length }
    );
  } else {
    logger.warn(`⚠️ HINT DEBUG: No valid strategy text found for tag "${tag}"`, {
      strategy,
      hasStrategy: !!strategy,
      hasStrategyProperty: !!(strategy && strategy.strategy),
      hasOverview: !!(strategy && strategy.overview),
      strategyType: typeof strategy
    });
  }
}

/**
 * Process general hints for individual tags
 */
export function processGeneralHints(problemTags, strategiesData, hints) {
  logger.info(`🔍 HINT DEBUG: Starting general hints processing for ${problemTags.length} tags`);
  logger.info(`🔍 HINT DEBUG: Available strategy data keys:`, Object.keys(strategiesData));
  logger.info(`🔍 HINT DEBUG: Current hints count before general:`, hints.length);

  for (const tag of problemTags) {
    processGeneralHintForTag(tag, strategiesData, hints);
  }

  logger.info(`🔍 HINT DEBUG: General hints processing completed. Final hints count:`, hints.length);
  const hintsAfterGeneral = hints.reduce((acc, hint) => {
    acc[hint.type] = (acc[hint.type] || 0) + 1;
    return acc;
  }, {});
  logger.info(`🔍 HINT DEBUG: Hints by type after general processing:`, hintsAfterGeneral);
}
