import { dbHelper } from "../db/index.js";
import { getTagRelationships, buildTagRelationships } from "../db/tag_relationships.js";
import strategyDataFile from "../constants/strategy_data.json";
import ProblemRelationshipService from "./problemRelationshipService.js";

// Natural cutoff thresholds for tier-based hint selection
const NATURAL_CUTOFFS = {
  TIER_1: 0.12,   // Essential relationships (top 5%)
  TIER_2: 0.045,  // Strong relationships (top 15%)
  TIER_3: 0.017   // Meaningful relationships (top 30%)
};

// Hint selection configuration
const HINT_CONFIG = {
  MAX_HINTS: 4,           // Maximum hints to show users
  TIER_WEIGHTS: {
    essential: 300,       // Highest priority
    strong: 200,          // Medium priority
    meaningful: 100       // Lower priority
  },
  HINT_DISTRIBUTION: {
    essential: { min: 1, max: 3 },     // Always show 1-3 essential
    strong: { min: 0, max: 2 },        // Up to 2 strong
    meaningful: { min: 0, max: 1 }     // At most 1 meaningful
  },
  // Difficulty-specific configuration
  DIFFICULTY_CONFIG: {
    'Easy': {
      maxHints: 3,
      preferredTypes: ['pattern', 'general'],  // Focus on basic patterns
      complexityBonus: 0,                      // No complexity bonus
      tierWeights: { essential: 300, strong: 150, meaningful: 50 }
    },
    'Medium': {
      maxHints: 4,
      preferredTypes: ['contextual', 'pattern', 'general'], // Balanced mix
      complexityBonus: 50,                     // Moderate complexity bonus
      tierWeights: { essential: 300, strong: 200, meaningful: 100 }
    },
    'Hard': {
      maxHints: 4,
      preferredTypes: ['contextual', 'optimization'], // Advanced techniques
      complexityBonus: 100,                    // High complexity bonus
      tierWeights: { essential: 350, strong: 250, meaningful: 150 }
    }
  }
};

/**
 * Strategy Service for managing strategy data in IndexedDB
 * Handles uploading, retrieving, and providing context-aware hints
 */
export class StrategyService {
  
  /**
   * Initialize strategy data in IndexedDB if not already present
   */
  static async initializeStrategyData() {
    try {
      const db = await dbHelper.openDB();
      const tx = db.transaction("strategy_data", "readonly");
      const store = tx.objectStore("strategy_data");
      
      // Check if data already exists
      const existingCount = await new Promise((resolve, reject) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      });

      if (existingCount > 0) {
        console.log(`✅ Strategy data already loaded (${existingCount} entries)`);
        return;
      }

      console.log("📥 Loading strategy data into IndexedDB...");
      await this.uploadStrategyData();
      console.log("✅ Strategy data initialization complete!");
      
    } catch (error) {
      console.error("❌ Error initializing strategy data:", error);
      throw error;
    }
  }

  /**
   * Upload strategy data from JSON file to IndexedDB
   */
  static async uploadStrategyData() {
    try {
      const db = await dbHelper.openDB();
      const tx = db.transaction("strategy_data", "readwrite");
      const store = tx.objectStore("strategy_data");

      let uploadedCount = 0;

      for (const strategyEntry of strategyDataFile) {
        const { tag, ...strategyData } = strategyEntry;
        
        await new Promise((resolve, reject) => {
          const putRequest = store.put({
            tag: tag,
            ...strategyData
          });
          
          putRequest.onsuccess = () => {
            uploadedCount++;
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        });
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log(`✅ Uploaded ${uploadedCount} strategy entries to IndexedDB`);
      return uploadedCount;

    } catch (error) {
      console.error("❌ Error uploading strategy data:", error);
      throw error;
    }
  }

  /**
   * Get strategy data for a specific tag
   * @param {string} tag - The tag name
   * @returns {Object|null} Strategy data object or null if not found
   */
  static async getStrategyForTag(tag) {
    try {
      const db = await dbHelper.openDB();
      const tx = db.transaction("strategy_data", "readonly");
      const store = tx.objectStore("strategy_data");

      return new Promise((resolve, reject) => {
        const getRequest = store.get(tag);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => reject(getRequest.error);
      });

    } catch (error) {
      console.error(`❌ Error getting strategy for tag "${tag}":`, error);
      return null;
    }
  }

  /**
   * Get multiple strategy data entries for an array of tags
   * @param {string[]} tags - Array of tag names
   * @returns {Object} Object with tag names as keys and strategy data as values
   */
  static async getStrategiesForTags(tags) {
    try {
      const strategies = {};
      
      console.log('📋 Loading strategies for tags:', tags);
      
      for (const tag of tags) {
        const strategy = await this.getStrategyForTag(tag);
        if (strategy) {
          strategies[tag] = strategy;
          console.log(`✅ Loaded strategy for [${tag}]:`, {
            hasStrategy: !!strategy.strategy,
            hasStrategies: !!strategy.strategies,
            strategiesCount: strategy.strategies ? strategy.strategies.length : 0,
            patterns: strategy.patterns
          });
        } else {
          console.log(`❌ No strategy found for [${tag}]`);
        }
      }

      console.log('📋 Final strategies loaded:', Object.keys(strategies));
      return strategies;

    } catch (error) {
      console.error("❌ Error getting strategies for tags:", error);
      return {};
    }
  }

  /**
   * Get context-aware strategies using intelligent tier-based selection with difficulty awareness
   * @param {string[]} problemTags - Tags associated with current problem
   * @param {string} difficulty - Problem difficulty ('Easy', 'Medium', 'Hard')
   * @param {number} problemId - Optional problem ID for relationship-based hints
   * @returns {Object[]} Array of optimal strategy hints
   */
  static async getContextualHints(problemTags, difficulty = 'Medium', problemId = null) {
    try {
      if (!problemTags || problemTags.length === 0) {
        return [];
      }

      console.log(`🧠 Starting intelligent hint selection for ${difficulty} problem with tags:`, problemTags);
      
      // Use new difficulty-aware intelligent selection
      return await this.buildOptimalHintSelection(problemTags, difficulty, problemId);

    } catch (error) {
      console.error("❌ Error getting contextual hints:", error);
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
  static async buildOptimalHintSelection(problemTags, difficulty = 'Medium', problemId = null) {
    try {
      const strategiesData = await this.getStrategiesForTags(problemTags);
      const difficultyConfig = HINT_CONFIG.DIFFICULTY_CONFIG[difficulty] || HINT_CONFIG.DIFFICULTY_CONFIG['Medium'];
      
      console.log(`🎯 Building ${difficulty}-aware hint selection using natural cutoff tiers`);
      console.log('📊 Strategy data loaded for tags:', Object.keys(strategiesData));
      console.log('⚙️ Difficulty config:', difficultyConfig);
      
      // Step 1: Analyze problem context for relationship-based enhancements
      let problemContext = { useTagBasedHints: true, relationshipBonuses: {} };
      if (problemId) {
        console.log(`🔍 Analyzing problem relationships for problem ${problemId}`);
        problemContext = await ProblemRelationshipService.analyzeProblemContext(
          problemId, problemTags, 5
        );
        
        if (!problemContext.useTagBasedHints) {
          console.log(`📈 Found ${problemContext.similarProblems.length} similar problems with context strength: ${problemContext.contextStrength.toFixed(2)}`);
          console.log('🔗 Relationship bonuses:', problemContext.relationshipBonuses);
        }
      }
      
      // Step 2: Collect all available strategy hints with tier classification
      const allHints = [];
      
      if (problemTags.length >= 2) {
        // Multi-tag problem: Focus on inter-tag relationships
        console.log('🔗 Multi-tag problem: analyzing tag pair relationships');
        allHints.push(...await this.collectInterTagHints(problemTags, strategiesData));
      }
      
      // Add intra-tag hints (single tag strategies) for diversity
      console.log('📋 Adding intra-tag hints for comprehensive coverage');
      allHints.push(...await this.collectIntraTagHints(problemTags, strategiesData));
      
      console.log(`📊 Total hints collected: ${allHints.length}`);
      
      // Step 3: Score and rank all hints using difficulty-aware tier-based algorithm with relationship bonuses
      const scoredHints = this.scoreAndRankHints(allHints, difficulty, difficultyConfig, problemContext);
      console.log('🏆 Top scored hints:', scoredHints.slice(0, 5).map(h => ({
        tags: `${h.primaryTag} + ${h.relatedTag || 'general'}`, 
        tier: h.tier, 
        type: h.type,
        score: h.finalScore
      })));
      
      // Step 4: Apply intelligent hint selection with difficulty-aware tier distribution
      const selectedHints = this.applyIntelligentSelection(scoredHints, difficultyConfig);
      
      console.log(`🎯 Selected ${selectedHints.length} optimal ${difficulty} hints:`);
      selectedHints.forEach((hint, index) => {
        console.log(`  ${index + 1}. [${hint.primaryTag}] + [${hint.relatedTag || 'general'}] (${hint.tier} tier, ${hint.type} type, score: ${hint.finalScore})`);
      });
      
      return selectedHints;
      
    } catch (error) {
      console.error("❌ Error building optimal hint selection:", error);
      return [];
    }
  }

  /**
   * Collect inter-tag relationship hints for multi-tag problems
   * @param {string[]} problemTags - Problem tags
   * @param {Object} strategiesData - Strategy data for all tags
   * @returns {Object[]} Array of inter-tag hints with tier classification
   */
  static async collectInterTagHints(problemTags, strategiesData) {
    const hints = [];
    
    for (let i = 0; i < problemTags.length; i++) {
      for (let j = i + 1; j < problemTags.length; j++) {
        const tagA = problemTags[i];
        const tagB = problemTags[j];
        
        // Find strategy for this tag pair
        const strategy = this.findStrategyForTagPair(tagA, tagB, strategiesData);
        if (strategy) {
          // Determine natural tier based on relationship strength patterns
          const tier = this.classifyRelationshipTier(tagA, tagB);
          
          hints.push({
            type: 'contextual',
            primaryTag: tagA,
            relatedTag: tagB,
            tip: strategy.tip,
            tier: tier,
            source: 'inter-tag',
            complexity: this.getHintComplexity(strategy.tip)
          });
        }
      }
    }
    
    console.log(`🔗 Collected ${hints.length} inter-tag hints`);
    return hints;
  }

  /**
   * Collect intra-tag hints for comprehensive coverage
   * @param {string[]} problemTags - Problem tags
   * @param {Object} strategiesData - Strategy data for all tags
   * @returns {Object[]} Array of intra-tag hints
   */
  static async collectIntraTagHints(problemTags, strategiesData) {
    const hints = [];
    
    for (const tag of problemTags) {
      const tagData = strategiesData[tag];
      if (!tagData) continue;
      
      // Add general strategy for fallback
      if (tagData.strategy) {
        hints.push({
          type: 'general',
          primaryTag: tag,
          relatedTag: null,
          tip: tagData.strategy,
          tier: 'meaningful', // General strategies are lower priority
          source: 'intra-tag',
          complexity: this.getHintComplexity(tagData.strategy)
        });
      }
      
      // Add top strategies from this tag (first few are likely highest strength)
      if (tagData.strategies && tagData.strategies.length > 0) {
        const topStrategies = tagData.strategies.slice(0, 3); // First 3 are highest strength
        
        topStrategies.forEach((strategy, index) => {
          // Classify tier based on position (first few are likely essential/strong)
          const tier = index === 0 ? 'essential' : index === 1 ? 'strong' : 'meaningful';
          
          hints.push({
            type: 'pattern',
            primaryTag: tag,
            relatedTag: strategy.when,
            tip: strategy.tip,
            tier: tier,
            source: 'intra-tag',
            complexity: this.getHintComplexity(strategy.tip)
          });
        });
      }
    }
    
    console.log(`📋 Collected ${hints.length} intra-tag hints`);
    return hints;
  }

  /**
   * Classify relationship tier based on known strong relationships
   * @param {string} tagA - First tag
   * @param {string} tagB - Second tag
   * @returns {string} Tier classification (essential, strong, meaningful)
   */
  static classifyRelationshipTier(tagA, tagB) {
    // Define known essential relationships (from natural cutoff analysis)
    const essentialPairs = new Set([
      'array+hash table', 'hash table+array',
      'array+sorting', 'sorting+array',
      'array+dynamic programming', 'dynamic programming+array',
      'hash table+string', 'string+hash table',
      'tree+depth-first search', 'depth-first search+tree',
      'binary tree+depth-first search', 'depth-first search+binary tree'
    ]);
    
    const strongPairs = new Set([
      'array+greedy', 'greedy+array',
      'string+dynamic programming', 'dynamic programming+string',
      'graph+breadth-first search', 'breadth-first search+graph',
      'sorting+greedy', 'greedy+sorting'
    ]);
    
    const pairKey = `${tagA}+${tagB}`;
    
    if (essentialPairs.has(pairKey)) {
      return 'essential';
    } else if (strongPairs.has(pairKey)) {
      return 'strong';
    } else {
      return 'meaningful';
    }
  }

  /**
   * Get hint complexity score based on content analysis
   * @param {string} tip - The hint text
   * @returns {number} Complexity score (1-3: simple to complex)
   */
  static getHintComplexity(tip) {
    const complexKeywords = [
      'optimize', 'complexity', 'algorithm', 'efficient', 'performance',
      'logarithmic', 'polynomial', 'amortized', 'space-time tradeoff'
    ];
    
    const advancedKeywords = [
      'memoization', 'dynamic programming', 'backtracking', 'pruning',
      'segment tree', 'trie', 'union find', 'topological sort'
    ];
    
    const tip_lower = tip.toLowerCase();
    
    if (advancedKeywords.some(keyword => tip_lower.includes(keyword))) {
      return 3; // Complex
    } else if (complexKeywords.some(keyword => tip_lower.includes(keyword))) {
      return 2; // Moderate
    } else {
      return 1; // Simple
    }
  }

  /**
   * Calculate complexity bonus based on difficulty level
   * @param {number} complexity - Hint complexity (1-3)
   * @param {string} difficulty - Problem difficulty
   * @param {Object} difficultyConfig - Difficulty configuration
   * @returns {number} Complexity bonus score
   */
  static getDifficultyComplexityBonus(complexity, difficulty, difficultyConfig) {
    const baseBonus = difficultyConfig.complexityBonus;
    
    switch (difficulty) {
      case 'Easy':
        // For easy problems, prefer simpler hints
        return complexity === 1 ? baseBonus : -(complexity - 1) * 20;
      
      case 'Medium':
        // For medium problems, balanced preference
        return complexity === 2 ? baseBonus : baseBonus * 0.5;
      
      case 'Hard':
        // For hard problems, prefer more complex hints
        return complexity * baseBonus;
      
      default:
        return 0;
    }
  }

  /**
   * Score and rank hints using difficulty-aware tier-based algorithm with relationship bonuses
   * @param {Object[]} hints - All collected hints
   * @param {string} difficulty - Problem difficulty level
   * @param {Object} difficultyConfig - Configuration for this difficulty
   * @param {Object} problemContext - Problem relationship context (optional)
   * @returns {Object[]} Scored and sorted hints
   */
  static scoreAndRankHints(hints, difficulty = 'Medium', difficultyConfig, problemContext = null) {
    return hints.map((hint, index) => {
      // Use difficulty-specific tier weights
      const tierWeight = difficultyConfig.tierWeights[hint.tier] || 50;
      
      // Diversity bonus (prefer different types)
      const diversityBonus = hint.source === 'inter-tag' ? 20 : 10;
      
      // Position bonus (earlier strategies in array are typically stronger)
      const positionBonus = Math.max(10 - index * 2, 0);
      
      // Difficulty-aware complexity bonus
      const complexityBonus = this.getDifficultyComplexityBonus(hint.complexity, difficulty, difficultyConfig);
      
      // Type preference bonus
      const typeBonus = difficultyConfig.preferredTypes.includes(hint.type) ? 30 : 0;
      
      // Problem relationship bonus
      const relationshipBonus = this.getRelationshipBonus(hint, problemContext);
      
      const finalScore = tierWeight + diversityBonus + positionBonus + complexityBonus + typeBonus + relationshipBonus;
      
      return {
        ...hint,
        finalScore: finalScore,
        relationshipBonus: relationshipBonus,
        chainPosition: 0 // Will be set during selection
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Calculate relationship bonus based on problem similarity data
   * @param {Object} hint - Hint object with tag information
   * @param {Object} problemContext - Problem relationship context
   * @returns {number} Relationship bonus score
   */
  static getRelationshipBonus(hint, problemContext) {
    if (!problemContext || problemContext.useTagBasedHints || !problemContext.relationshipBonuses) {
      return 0;
    }
    
    // Create pair key for relationship lookup
    let pairKey = null;
    if (hint.relatedTag && hint.relatedTag !== hint.primaryTag) {
      // Multi-tag hint: use sorted pair
      pairKey = [hint.primaryTag.toLowerCase().trim(), hint.relatedTag.toLowerCase().trim()]
        .sort()
        .join('+');
    } else {
      // Single tag hint: check if it appears in any relationship
      const primaryTag = hint.primaryTag.toLowerCase().trim();
      for (const key of Object.keys(problemContext.relationshipBonuses)) {
        if (key.includes(primaryTag)) {
          pairKey = key;
          break;
        }
      }
    }
    
    const bonus = pairKey ? (problemContext.relationshipBonuses[pairKey] || 0) : 0;
    
    if (bonus > 0) {
      console.log(`🔗 Relationship bonus for [${hint.primaryTag}] + [${hint.relatedTag || 'general'}]: +${bonus}`);
    }
    
    return bonus;
  }

  /**
   * Apply intelligent selection with tier distribution constraints
   * @param {Object[]} scoredHints - All hints scored and ranked
   * @returns {Object[]} Selected optimal hints
   */
  static applyIntelligentSelection(scoredHints, difficultyConfig) {
    const selected = [];
    const tierCounts = { essential: 0, strong: 0, meaningful: 0 };
    const usedPairs = new Set();
    
    for (const hint of scoredHints) {
      // Check tier distribution limits
      const tierConfig = HINT_CONFIG.HINT_DISTRIBUTION[hint.tier];
      if (tierCounts[hint.tier] >= tierConfig.max) {
        continue; // Skip if tier is full
      }
      
      // Check for duplicates
      const pairKey = hint.relatedTag ? 
        [hint.primaryTag, hint.relatedTag].sort().join(':') : 
        hint.primaryTag;
      
      if (usedPairs.has(pairKey)) {
        continue; // Skip duplicates
      }
      
      // Add to selection
      selected.push({
        ...hint,
        relevance: hint.finalScore / 300, // Normalize for UI
        chainPosition: selected.length + 1
      });
      
      tierCounts[hint.tier]++;
      usedPairs.add(pairKey);
      
      // Stop when we have enough hints
      if (selected.length >= difficultyConfig.maxHints) {
        break;
      }
    }
    
    // Ensure we have at least one essential hint if available
    if (tierCounts.essential === 0 && scoredHints.some(h => h.tier === 'essential')) {
      console.log('⚠️ No essential hints selected, adjusting selection...');
      // Could implement fallback logic here if needed
    }
    
    console.log('📊 Final tier distribution:', tierCounts);
    return selected;
  }

  /**
   * Find strategy tip for a specific tag pair from strategy data
   * @param {string} tagA - Primary tag
   * @param {string} tagB - Related tag
   * @param {Object} strategiesData - Strategy data for all tags
   * @returns {Object|null} Strategy object with tip, or null if not found
   */
  static findStrategyForTagPair(tagA, tagB, strategiesData) {
    try {
      // Check tagA strategies for tagB
      if (strategiesData[tagA] && strategiesData[tagA].strategies) {
        for (const strategy of strategiesData[tagA].strategies) {
          if (strategy.when === tagB) {
            return strategy;
          }
        }
      }
      
      // Check tagB strategies for tagA
      if (strategiesData[tagB] && strategiesData[tagB].strategies) {
        for (const strategy of strategiesData[tagB].strategies) {
          if (strategy.when === tagA) {
            return strategy;
          }
        }
      }
      
      // Fallback: return general strategy from primary tag
      if (strategiesData[tagA] && strategiesData[tagA].strategy) {
        return {
          tip: strategiesData[tagA].strategy,
          when: null
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error finding strategy for pair ${tagA}-${tagB}:`, error);
      return null;
    }
  }

  /**
   * Get primer information for a specific tag (for pre-problem display)
   * @param {string} tag - The tag name
   * @returns {Object|null} Primer information with overview and general strategy
   */
  static async getTagPrimer(tag) {
    try {
      const strategyData = await this.getStrategyForTag(tag);
      
      if (!strategyData) {
        return null;
      }

      return {
        tag: tag,
        overview: strategyData.overview,
        strategy: strategyData.strategy,
        patterns: strategyData.patterns || [],
        related: strategyData.related || []
      };

    } catch (error) {
      console.error(`❌ Error getting primer for tag "${tag}":`, error);
      return null;
    }
  }

  /**
   * Get primers for multiple tags (for multi-tag problems)
   * @param {string[]} tags - Array of tag names
   * @returns {Object[]} Array of primer objects
   */
  static async getTagPrimers(tags) {
    try {
      const primers = [];
      
      for (const tag of tags) {
        const primer = await this.getTagPrimer(tag);
        if (primer) {
          primers.push(primer);
        }
      }

      return primers;

    } catch (error) {
      console.error("❌ Error getting tag primers:", error);
      return [];
    }
  }

  /**
   * Check if strategy data is loaded in IndexedDB
   * @returns {boolean} True if data exists, false otherwise
   */
  static async isStrategyDataLoaded() {
    try {
      const db = await dbHelper.openDB();
      const tx = db.transaction("strategy_data", "readonly");
      const store = tx.objectStore("strategy_data");
      
      const count = await new Promise((resolve, reject) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      });

      return count > 0;

    } catch (error) {
      console.error("❌ Error checking strategy data:", error);
      return false;
    }
  }

  /**
   * Get all available strategy tags
   * @returns {string[]} Array of all tag names with strategy data
   */
  static async getAllStrategyTags() {
    try {
      const db = await dbHelper.openDB();
      const tx = db.transaction("strategy_data", "readonly");
      const store = tx.objectStore("strategy_data");
      
      return new Promise((resolve, reject) => {
        const getAllRequest = store.getAllKeys();
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      });

    } catch (error) {
      console.error("❌ Error getting all strategy tags:", error);
      return [];
    }
  }
}

// Initialize strategy data when service is imported
StrategyService.initializeStrategyData().catch(error => {
  console.error("❌ Failed to initialize strategy data:", error);
});

export default StrategyService;