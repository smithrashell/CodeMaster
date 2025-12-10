import strategyCacheService from "../../shared/services/hints/StrategyCacheService.js";
import performanceMonitor from "../../shared/utils/performance/PerformanceMonitor.js";
import chromeMessaging from "./chromeMessagingService.js";
import { success, debug, data, system } from "../../shared/utils/logging/logger.js";
import logger from "../../shared/utils/logging/logger.js";
import {
  FALLBACK_STRATEGIES,
  HINT_CONFIG,
  COMMON_TAGS,
  createContextualHints,
  processContextualHints,
  processGeneralHints,
} from "./strategyServiceHelpers.js";

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
        processContextualHints(problemTags, strategiesData, hints);
      }

      // Then, create general hints for individual tags
      processGeneralHints(problemTags, strategiesData, hints);

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

}

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
