import strategyCacheService from "../../shared/services/StrategyCacheService.js";
import performanceMonitor from "../../shared/utils/PerformanceMonitor.js";
import chromeMessaging from "./chromeMessagingService.js";
import { success, debug, data, system } from "../../shared/utils/logger.js";
import logger from "../../shared/utils/logger.js";

// Fallback strategy data when database is unavailable
const FALLBACK_STRATEGIES = {
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
const HINT_CONFIG = {
  MAX_HINTS: 4, // Maximum hints to show users
  TIER_WEIGHTS: {
    essential: 300, // Highest priority
    strong: 200, // Medium priority
    meaningful: 100, // Lower priority
  },
  HINT_DISTRIBUTION: {
    essential: { min: 1, max: 3 }, // Always show 1-3 essential
    strong: { min: 0, max: 2 }, // Up to 2 strong
    meaningful: { min: 0, max: 1 }, // At most 1 meaningful
  },
  // Difficulty-specific configuration
  DIFFICULTY_CONFIG: {
    Easy: {
      maxHints: 3,
      preferredTypes: ["pattern", "general"], // Focus on basic patterns
      complexityBonus: 0, // No complexity bonus
      tierWeights: { essential: 300, strong: 150, meaningful: 50 },
    },
    Medium: {
      maxHints: 4,
      preferredTypes: ["contextual", "pattern", "general"], // Balanced mix
      complexityBonus: 50, // Moderate complexity bonus
      tierWeights: { essential: 300, strong: 200, meaningful: 100 },
    },
    Hard: {
      maxHints: 4,
      preferredTypes: ["contextual", "optimization"], // Advanced techniques
      complexityBonus: 100, // High complexity bonus
      tierWeights: { essential: 350, strong: 250, meaningful: 150 },
    },
  },
};

/**
 * Helper function to create contextual hints for multi-tag combinations
 * @param {string} primaryTag - The primary tag
 * @param {Object} strategyData - Strategy data for the tag
 * @param {string[]} problemTags - All problem tags
 * @returns {Object[]} Array of contextual hints
 */
const createContextualHints = (primaryTag, strategyData, problemTags) => {
  const contextualHints = [];
  
  if (strategyData.strategies && problemTags.length > 1) {
    for (const strategyEntry of strategyData.strategies) {
      // Check if the related tag is also in the problem tags
      if (problemTags.includes(strategyEntry.when)) {
        contextualHints.push({
          type: 'contextual',
          primaryTag: primaryTag,
          relatedTag: strategyEntry.when,
          tip: strategyEntry.tip,
          relevance: 1.5 // Higher relevance for multi-tag strategies
        });
      }
    }
  }
  
  return contextualHints;
};

/**
 * Strategy Service for managing strategy data in IndexedDB
 * Handles retrieving and providing context-aware hints
 */
export class StrategyService {
  /**
   * Initialize strategy data - delegates to background script
   */
  static async initializeStrategyData() {
    try {
      system("🔧 CONTENT: Starting strategy data initialization via robust messaging");

      const isLoaded = await chromeMessaging.sendMessage(
        {
          type: "isStrategyDataLoaded",
        },
        {
          timeout: 5000, // Increased timeout for reliability
          retries: 1,
          cacheable: true,
          cacheKey: "strategy_data_loaded_status",
        }
      );

      if (isLoaded) {
        success("✅ CONTENT: Strategy data already loaded");
        return true;
      }

      data("📊 CONTENT: Strategy data initialization handled by background script onboarding");

      return true;
    } catch (error) {
      logger.error("❌ CONTENT: Error initializing strategy data:", error);
      return false;
    }
  }

  /**
   * Get strategy data for a specific tag (cached)
   * @param {string} tag - The tag name
   * @returns {Object|null} Strategy data object or null if not found
   */
  static async getStrategyForTag(tag) {
    const queryContext = performanceMonitor.startQuery("getStrategyForTag", {
      tag,
    });

    try {
      // eslint-disable-next-line no-console
      logger.info(
        `🔍 CONTENT: Getting strategy for tag: "${tag}" via robust messaging`
      );

      const dbResult = await chromeMessaging.sendMessage(
        {
          type: "getStrategyForTag",
          tag: tag,
        },
        {
          timeout: 10000, // 10 second timeout for safety margin
          retries: 2, // Fewer retries for faster response
          cacheable: true,
          cacheKey: `strategy_${tag.toLowerCase()}`,
        }
      );

      if (dbResult) {
        // eslint-disable-next-line no-console
        performanceMonitor.endQuery(
          queryContext,
          true,
          JSON.stringify(dbResult).length
        );
        return dbResult;
      }

      // Try fallback strategy data
      const fallback = FALLBACK_STRATEGIES[tag.toLowerCase()];
      if (fallback) {
        // eslint-disable-next-line no-console
        logger.info(
          `🔄 CONTENT: Using local fallback strategy for tag "${tag}"`
        );
        performanceMonitor.endQuery(
          queryContext,
          true,
          JSON.stringify(fallback).length
        );
        return fallback;
      }


      // eslint-disable-next-line no-console
      logger.info(
        `❌ CONTENT: No strategy found for "${tag}" (all fallbacks exhausted)`
      );

      performanceMonitor.endQuery(queryContext, true, 0);
      return null;
    } catch (error) {
      logger.error(
        `❌ CONTENT: Error getting strategy for tag "${tag}":`,
        error
      );

      // Try fallback strategy data
      const fallback = FALLBACK_STRATEGIES[tag.toLowerCase()];
      if (fallback) {
        // eslint-disable-next-line no-console
        logger.info(
          `🔄 CONTENT: Using local fallback strategy for tag "${tag}" (after error)`
        );
        performanceMonitor.endQuery(
          queryContext,
          true,
          JSON.stringify(fallback).length
        );
        return fallback;
      }


      performanceMonitor.endQuery(queryContext, false, 0, error);
      return null;
    }
  }

  /**
   * Get multiple strategy data entries for an array of tags (optimized with parallel processing)
   * @param {string[]} tags - Array of tag names
   * @returns {Object} Object with tag names as keys and strategy data as values
   */
  static async getStrategiesForTags(tags) {
    const queryContext = performanceMonitor.startQuery("getStrategiesForTags", {
      tagCount: tags.length,
    });

    try {
      // Direct execution without caching for now
      const result = await (async () => {
          // eslint-disable-next-line no-console
          data("📋 Loading strategies for tags (parallel)", { tags });

          // Process all tags in parallel
          const strategyPromises = tags.map(async (tag) => {
            try {
              const strategy = await this.getStrategyForTag(tag);
              if (strategy) {
                success(`✅ Loaded strategy for [${tag}]`);
                return { tag, strategy };
              }
              debug(`❌ No strategy found for [${tag}]`);
              return null;
            } catch (error) {
              logger.error(`❌ Error loading strategy for [${tag}]:`, error);
              return null;
            }
          });

          const results = await Promise.all(strategyPromises);

          // Convert results to object format
          const strategies = {};
          results.forEach((result) => {
            if (result && result.strategy) {
              strategies[result.tag] = result.strategy;
            }
          });

          // eslint-disable-next-line no-console
          logger.info(
            "📋 Final strategies loaded (parallel):",
            Object.keys(strategies)
          );
          return strategies;
        })();

      performanceMonitor.endQuery(
        queryContext,
        true,
        Object.keys(result).length
      );
      return result;
    } catch (error) {
      logger.error("❌ Error getting strategies for tags:", error);
      performanceMonitor.endQuery(queryContext, false, 0, error);
      return {};
    }
  }

  /**
   * Get context-aware strategies using intelligent tier-based selection with difficulty awareness (cached)
   * @param {string[]} problemTags - Tags associated with current problem
   * @param {string} difficulty - Problem difficulty ('Easy', 'Medium', 'Hard')
   * @param {number} problemId - Optional problem ID for relationship-based hints
   * @returns {Object[]} Array of optimal strategy hints
   */
  static async getContextualHints(
    problemTags,
    difficulty = "Medium",
    problemId = null
  ) {
    const queryContext = performanceMonitor.startQuery("getContextualHints", {
      tagCount: problemTags?.length || 0,
      difficulty,
      hasProblemId: !!problemId,
    });

    try {
      if (!problemTags || problemTags.length === 0) {
        performanceMonitor.endQuery(queryContext, true, 0);
        return [];
      }

      const strategiesData = await this.getStrategiesForTags(problemTags);
      const hints = [];

      for (const [primaryTag, strategyData] of Object.entries(strategiesData)) {
        // Add general strategy for the tag
        if (strategyData.strategy) {
          hints.push({
            type: 'general',
            primaryTag: primaryTag,
            relatedTag: null,
            tip: strategyData.strategy,
            relevance: 1.0
          });
        }

        // Add contextual strategies when multiple tags are present
        const contextualHints = createContextualHints(primaryTag, strategyData, problemTags);
        hints.push(...contextualHints);
      }

      // Remove duplicates based on tip content (case-insensitive)
      const deduplicatedHints = [];
      const seenTips = new Set();
      
      for (const hint of hints) {
        const normalizedTip = hint.tip.toLowerCase().trim();
        if (!seenTips.has(normalizedTip)) {
          seenTips.add(normalizedTip);
          deduplicatedHints.push(hint);
        }
      }
      
      // Sort by relevance (contextual hints first, then general)
      deduplicatedHints.sort((a, b) => b.relevance - a.relevance);

      // Apply difficulty-based hint limits
      const difficultyConfig =
        HINT_CONFIG.DIFFICULTY_CONFIG[difficulty] ||
        HINT_CONFIG.DIFFICULTY_CONFIG["Medium"];

      const limitedHints = deduplicatedHints.slice(0, difficultyConfig.maxHints);
      
      // Applied ${difficulty} difficulty limits (${hints.length} → ${deduplicatedHints.length} → ${limitedHints.length})

      performanceMonitor.endQuery(queryContext, true, limitedHints.length);
      return limitedHints;
    } catch (error) {
      logger.error("❌ Error getting contextual hints:", error);
      performanceMonitor.endQuery(queryContext, false, 0, error);
      return [];
    }
  }

  /**
   * Create normalized tag pair key to prevent duplicates
   * @private
   */
  static _createNormalizedTagPair(tag1, tag2) {
    return [tag1, tag2].sort().join("+");
  }

  /**
   * Process contextual hints for multi-tag combinations
   * @private
   */
  static _processContextualHints(problemTags, strategiesData, hints) {
    try {
      logger.info(
        `🔍 HINT DEBUG: Creating contextual hints for ${problemTags.length} tags`
      );

      // Track processed combinations to prevent duplicates
      const processedCombinations = new Set();

      // Generate contextual hints for tag pairs (deduplication applied)
      for (let i = 0; i < problemTags.length; i++) {
        for (let j = i + 1; j < problemTags.length; j++) {
          const primaryTag = problemTags[i];
          const relatedTag = problemTags[j];

          // Create normalized key to prevent duplicates like array+hashtable vs hashtable+array
          const normalizedKey = StrategyService._createNormalizedTagPair(primaryTag, relatedTag);
          
          if (processedCombinations.has(normalizedKey)) {
            logger.info(`🔄 HINT DEBUG: Skipping duplicate combination: ${normalizedKey}`);
            continue;
          }

          processedCombinations.add(normalizedKey);
          logger.info(`🔍 HINT DEBUG: Processing contextual pair: ${primaryTag} + ${relatedTag} (normalized: ${normalizedKey})`);
          
          try {
            StrategyService._addContextualHintIfValid(
              primaryTag,
              relatedTag,
              strategiesData,
              hints
            );
            logger.info(`✅ HINT DEBUG: Contextual pair processed successfully`);
          } catch (contextError) {
            logger.error(`❌ HINT DEBUG: Error in contextual hint creation:`, {
              primaryTag,
              relatedTag,
              error: contextError.message,
              stack: contextError.stack
            });
            // Continue processing other hints - don't let contextual hint errors break everything
            continue;
          }
        }
      }
    } catch (contextualSectionError) {
      logger.error(`❌ HINT DEBUG: Error in entire contextual hints section:`, {
        error: contextualSectionError.message,
        stack: contextualSectionError.stack
      });
      // Continue to general hints even if contextual hints fail completely
    }
  }

  /**
   * Process general hints for individual tags
   * @private
   */
  static _processGeneralHints(problemTags, strategiesData, hints) {
    logger.info(`🔍 HINT DEBUG: Starting general hints processing for ${problemTags.length} tags`);
    logger.info(`🔍 HINT DEBUG: Available strategy data keys:`, Object.keys(strategiesData));
    logger.info(`🔍 HINT DEBUG: Current hints count before general:`, hints.length);
    
    for (const tag of problemTags) {
      this._processGeneralHintForTag(tag, strategiesData, hints);
    }
    
    // Debug after general hints loop
    logger.info(`🔍 HINT DEBUG: General hints processing completed. Final hints count:`, hints.length);
    const hintsAfterGeneral = hints.reduce((acc, hint) => {
      acc[hint.type] = (acc[hint.type] || 0) + 1;
      return acc;
    }, {});
    logger.info(`🔍 HINT DEBUG: Hints by type after general processing:`, hintsAfterGeneral);
  }

  /**
   * Process a general hint for a single tag
   * @private
   */
  static _processGeneralHintForTag(tag, strategiesData, hints) {
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

    const { strategyText, debugSource } = this._extractStrategyText(tag, strategy);
    
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
   * Extract strategy text from strategy object
   * @private
   */
  static _extractStrategyText(tag, strategy) {
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
   * Build optimal hint selection using natural cutoff tiers, difficulty awareness, and problem relationships
   * @param {string[]} problemTags - Tags associated with current problem
   * @param {string} difficulty - Problem difficulty level
   * @param {number} problemId - Optional problem ID for relationship-based hints
   * @returns {Object[]} Array of optimally selected hints
   */
  static async buildOptimalHintSelection(
    problemTags,
    difficulty = "Medium",
    _problemId = null
  ) {
    let strategiesData = null;
    let hints = [];
    
    try {
      // eslint-disable-next-line no-console
      logger.info(
        "🔍 HINT DEBUG: Starting buildOptimalHintSelection with tags:",
        problemTags
      );

      strategiesData = await this.getStrategiesForTags(problemTags);

      // Check if strategies data is valid
      if (!strategiesData || typeof strategiesData !== 'object') {
        logger.warn("⚠️ No valid strategies data received, returning empty hints");
        return [];
      }

      // Log strategy availability (but don't return early - let fallbacks work)
      const strategyKeys = Object.keys(strategiesData);
      logger.info(`📊 HINT DEBUG: Received strategies for tags:`, { 
        availableStrategies: strategyKeys,
        requestedTags: problemTags,
        missingStrategies: problemTags.filter(tag => !strategiesData[tag])
      });

      const difficultyConfig =
        HINT_CONFIG.DIFFICULTY_CONFIG[difficulty] ||
        HINT_CONFIG.DIFFICULTY_CONFIG["Medium"];

      // eslint-disable-next-line no-console
      logger.info(
        `🎯 Building ${difficulty}-aware hint selection using natural cutoff tiers`
      );

      // Build both contextual and general hints
      hints = [];

      // First, create contextual hints for multi-tag combinations
      if (problemTags.length > 1) {
        this._processContextualHints(problemTags, strategiesData, hints);
      }

      // Then, create general hints for individual tags  
      this._processGeneralHints(problemTags, strategiesData, hints);

      // Apply balanced hint distribution (max 2 contextual + 2-3 general hints)
      const contextualHints = hints.filter(h => h.type === 'contextual').sort((a, b) => b.relevance - a.relevance);
      const generalHints = hints.filter(h => h.type === 'general').sort((a, b) => b.relevance - a.relevance);

      // Select top quality contextual hints (max 2) and fill remaining with general hints
      const maxContextual = 2;
      const selectedContextual = contextualHints.slice(0, maxContextual);
      const remainingSlots = difficultyConfig.maxHints - selectedContextual.length;
      const selectedGeneral = generalHints.slice(0, remainingSlots);

      const finalHints = [...selectedContextual, ...selectedGeneral];
      
      // DEBUG: Log balanced distribution results
      const hintsByType = finalHints.reduce((acc, hint) => {
        acc[hint.type] = (acc[hint.type] || 0) + 1;
        return acc;
      }, {});
      
      logger.info(`🔧 DEBUG: buildOptimalHintSelection returning ${finalHints.length} hints:`, {
        total: finalHints.length,
        byType: hintsByType,
        hints: finalHints.map(h => ({
          type: h.type,
          primaryTag: h.primaryTag,
          relatedTag: h.relatedTag,
          tipPreview: h.tip ? h.tip.substring(0, 50) + '...' : 'No tip'
        }))
      });

      return finalHints;
    } catch (error) {
      logger.error("❌ Error building optimal hint selection:", {
        error: error.message,
        stack: error.stack,
        problemTags,
        strategiesDataKeys: Object.keys(strategiesData || {}),
        strategiesDataSample: strategiesData,
        hintsBuiltSoFar: hints.length
      });
      return [];
    }
  }

  /**
   * Generate contextual hint by combining strategies from two related tags
   * @param {string} primaryTag - The primary tag
   * @param {string} relatedTag - The related tag
   * @param {Object} primaryStrategy - Strategy data for primary tag
   * @param {Object} relatedStrategy - Strategy data for related tag
   * @returns {Object} Combined contextual tip with quality score
   */
  static generateContextualTip(
    primaryTag,
    relatedTag,
    primaryStrategy,
    relatedStrategy
  ) {
    // Define common tag combinations and their contextual strategies
    const contextualCombinations = {
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

    // Create a key for the combination (order independent)
    const combinationKey1 = `${primaryTag}+${relatedTag}`;
    const combinationKey2 = `${relatedTag}+${primaryTag}`;

    // Check if we have a specific contextual strategy for this combination
    const contextualTip =
      contextualCombinations[combinationKey1] ||
      contextualCombinations[combinationKey2];

    if (contextualTip) {
      // High quality - specific combination exists in our curated list
      return { tip: contextualTip, quality: 2.0 };
    }

    // If no specific combination exists, generate a generic contextual hint
    const primaryKeyword = StrategyService.extractKeyword(primaryStrategy.strategy);
    const relatedKeyword = StrategyService.extractKeyword(relatedStrategy.strategy);

    const genericTip = `Combine ${primaryTag} techniques with ${relatedTag} patterns. Consider using ${primaryKeyword} alongside ${relatedKeyword} for an optimal solution approach.`;
    
    // Lower quality - generic combination
    return { tip: genericTip, quality: 1.0 };
  }

  /**
   * Extract key technique/approach from strategy text
   * @param {string} strategy - Strategy description text
   * @returns {string} Key technique extracted
   */
  static extractKeyword(strategy) {
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

    // Default fallback
    return "systematic approach";
  }

  /**
   * Get primer information for a specific tag (for pre-problem display) - cached
   * @param {string} tag - The tag name
   * @returns {Object|null} Primer information with overview and general strategy
   */
  static async getTagPrimer(tag) {
    const queryContext = performanceMonitor.startQuery("getTagPrimer", { tag });

    try {
      // BYPASS CACHE TEMPORARILY - Direct call to test background script communication
      // eslint-disable-next-line no-console
      logger.info(
        `🔍 CONTENT: Getting primer for tag "${tag}" (cache bypassed)`
      );

      const strategyData = await this.getStrategyForTag(tag);

      if (!strategyData) {
        // eslint-disable-next-line no-console
        logger.info(`❌ CONTENT: No strategy data found for tag "${tag}"`);
        performanceMonitor.endQuery(queryContext, true, 0);
        return null;
      }

      const result = {
        tag: tag,
        overview: strategyData.overview,
        strategy: strategyData.strategy,
        patterns: strategyData.patterns || [],
        related: strategyData.related || [],
      };

      // eslint-disable-next-line no-console
      logger.info(`✅ CONTENT: Created primer for tag "${tag}":`, result);

      performanceMonitor.endQuery(
        queryContext,
        true,
        JSON.stringify(result).length
      );
      return result;
    } catch (error) {
      logger.error(
        `❌ CONTENT: Error getting primer for tag "${tag}":`,
        error
      );
      performanceMonitor.endQuery(queryContext, false, 0, error);
      return null;
    }
  }

  /**
   * Get primers for multiple tags (for multi-tag problems) - optimized with parallel processing
   * @param {string[]} tags - Array of tag names
   * @returns {Object[]} Array of primer objects
   */
  static async getTagPrimers(tags) {
    const queryContext = performanceMonitor.startQuery("getTagPrimers", {
      tagCount: tags.length,
    });

    try {
      // BYPASS CACHE TEMPORARILY - Direct parallel processing to test background script communication
      // eslint-disable-next-line no-console
      logger.info(
        `🔍 STRATEGY SERVICE: Getting primers for ${tags.length} tags:`,
        tags
      );
      
      // Processing getTagPrimers for ${tags.length} tags

      // Process all tags in parallel
      const primerPromises = tags.map(async (tag) => {
        try {
          const result = await this.getTagPrimer(tag);
          return result;
        } catch (error) {
          console.error(`❌ STRATEGY SERVICE: Error getting primer for tag "${tag}":`, error);
          logger.error(
            `❌ CONTENT: Error getting primer for tag "${tag}":`,
            error
          );
          return null;
        }
      });

      const primers = await Promise.all(primerPromises);
      const result = primers.filter((primer) => primer !== null);

      // getTagPrimers completed: ${result.length}/${tags.length} primers found

      // eslint-disable-next-line no-console
      logger.info(
        `✅ CONTENT: Got ${result.length} primers out of ${tags.length} tags:`,
        result.map((p) => p.tag)
      );

      performanceMonitor.endQuery(queryContext, true, result.length);
      return result;
    } catch (error) {
      logger.error("❌ CONTENT: Error getting tag primers:", error);
      performanceMonitor.endQuery(queryContext, false, 0, error);
      return [];
    }
  }

  /**
   * Check if strategy data is loaded in IndexedDB
   * @returns {boolean} True if data exists, false otherwise
   */
  static async isStrategyDataLoaded() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "isStrategyDataLoaded",
      });

      if (response.status === "success") {
        return response.data;
      } else {
        logger.error(
          "❌ CONTENT: Background script error checking data status:",
          response.error
        );
        return false;
      }
    } catch (error) {
      logger.error("❌ CONTENT: Error checking strategy data:", error);
      return false;
    }
  }

  /**
   * Get all available strategy tags
   * @returns {string[]} Array of all tag names with strategy data
   */
  static getAllStrategyTags() {
    try {
      // For now, return fallback tags as this method isn't used in the main flow
      // Could add a background script handler if needed later
      logger.warn("⚠️ CONTENT: getAllStrategyTags using fallback data only");
      return Object.keys(FALLBACK_STRATEGIES);
    } catch (error) {
      logger.error("❌ CONTENT: Error getting all strategy tags:", error);
      return [];
    }
  }

  /**
   * Adds a contextual hint if both strategies are valid
   * @private
   */
  static _addContextualHintIfValid(primaryTag, relatedTag, strategiesData, hints) {
    const primaryStrategy = strategiesData[primaryTag];
    const relatedStrategy = strategiesData[relatedTag];

    if (!primaryStrategy || !relatedStrategy) {
      return;
    }

    // Generate contextual hint combining both strategies
    const contextualResult = StrategyService.generateContextualTip(
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
      relevance: 1.0 + (contextualResult.quality * 0.2), // Quality-based relevance boost
      relationshipScore: contextualResult.quality / 2.0, // Quality-based relationship score
      finalScore: 300 + (contextualResult.quality * 50),
      chainPosition: hints.length + 1,
    };

    hints.push(contextualHint);
    // eslint-disable-next-line no-console
    logger.info(
      `✅ HINT DEBUG: Added contextual hint for "${primaryTag}" + "${relatedTag}":`,
      contextualHint
    );
  }

}

// Pre-warm cache with commonly used strategies
const COMMON_TAGS = [
  "array",
  "hash table",
  "string",
  "sorting",
  "tree",
  "dynamic programming",
];

const preWarmCache = () => {
  try {
    logger.info("🔥 CONTENT: Pre-warming strategy cache for common tags...");

    // Fire and forget - don't wait for these
    COMMON_TAGS.forEach(async (tag) => {
      try {
        await StrategyService.getStrategyForTag(tag);
      } catch (error) {
        logger.warn(`⚠️ Pre-warm failed for ${tag}:`, error.message);
      }
    });

    logger.info(
      "🔥 CONTENT: Pre-warm cache initiated for",
      COMMON_TAGS.length,
      "common tags"
    );
  } catch (error) {
    logger.warn("⚠️ Pre-warm cache failed:", error);
  }
};

// Initialize strategy data when service is imported - use onboarding system
StrategyService.initializeStrategyData()
  .then(() => {
    // Pre-warm cache after initialization
    setTimeout(preWarmCache, 1000); // Delay to avoid blocking main thread
  })
  .catch((error) => {
    logger.error("❌ Strategy initialization failed, using fallbacks:", error);
  });

// Expose cache and performance utilities
StrategyService.cache = strategyCacheService;
StrategyService.performance = performanceMonitor;
StrategyService.messaging = chromeMessaging;


export default StrategyService;
