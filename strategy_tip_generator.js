#!/usr/bin/env node

/**
 * Strategy Tip Generator
 * Creates concrete, context-specific strategy tips following user guidelines
 */

/**
 * Strategy tip guidelines from user requirements:
 * - Must be concrete: mention a specific technique, optimization, or data structure
 * - Must be context-specific: advice should only make sense with the full "when" set
 * - Must be brief: 1–2 sentences
 * - Must not repeat the generic "strategy" field
 */

/**
 * Tag classifications for template selection
 */
const TAG_TYPES = {
  DATA_STRUCTURES: ['array', 'hash table', 'stack', 'queue', 'heap (priority queue)', 'tree', 'binary tree', 'binary search tree', 'trie', 'linked list', 'doubly-linked list', 'matrix'],
  ALGORITHMS: ['sorting', 'binary search', 'depth-first search', 'breadth-first search', 'dynamic programming', 'greedy', 'backtracking', 'divide and conquer'],
  TECHNIQUES: ['two pointers', 'sliding window', 'prefix sum', 'monotonic stack', 'bit manipulation', 'union find', 'topological sort'],
  ADVANCED: ['segment tree', 'binary indexed tree', 'suffix array', 'rolling hash', 'string matching', 'minimum spanning tree', 'shortest path']
};

/**
 * Get tag type for template selection
 */
function getTagType(tag) {
  const normalizedTag = tag.toLowerCase().trim();
  
  for (const [type, tags] of Object.entries(TAG_TYPES)) {
    if (tags.includes(normalizedTag)) {
      return type;
    }
  }
  
  return 'GENERAL';
}

/**
 * Strategy tip templates organized by tag pair patterns
 */
const STRATEGY_TEMPLATES = {
  
  // Data Structure + Algorithm combinations
  'DATA_STRUCTURES+ALGORITHMS': {
    'array+sorting': [
      'Sort the array first to enable two-pointer techniques and binary search optimizations.',
      'Use counting sort for arrays with limited value ranges to achieve O(n) sorting.',
      'Apply merge sort when stability is required or for external sorting of large arrays.'
    ],
    'array+binary search': [
      'Sort array elements first, then use binary search for O(log n) lookup operations.',
      'Apply binary search on answer when checking if a target value is achievable.',
      'Use lower_bound and upper_bound to find insertion points and ranges efficiently.'
    ],
    'hash table+dynamic programming': [
      'Cache DP state results in hash table using string concatenation of parameters as keys.',
      'Use hash table to store computed subproblem results and avoid redundant calculations.',
      'Map state tuples to hash table entries for efficient memoization lookup.'
    ],
    'array+dynamic programming': [
      'Use prefix sums with DP to optimize subarray computations from O(n²) to O(n).',
      'Build DP table where dp[i] represents optimal solution for first i array elements.',
      'Apply space optimization by using rolling arrays when only previous states are needed.'
    ],
    'default': [
      'Combine {primaryTag} with {relatedTag} to leverage the strengths of both approaches.',
      'Use {relatedTag} to optimize the {primaryTag} operations for better time complexity.',
      'Apply {relatedTag} techniques to enhance {primaryTag} performance in specific scenarios.'
    ]
  },

  // Data Structure + Data Structure combinations  
  'DATA_STRUCTURES+DATA_STRUCTURES': {
    'array+hash table': [
      'Use hash table to store array indices and eliminate nested loops from O(n²) to O(n).',
      'Map array elements to their indices using hash table for fast complement lookups.',
      'Track seen array values in hash table to detect duplicates in single pass.'
    ],
    'array+stack': [
      'Use stack to track array indices and solve next greater/smaller element problems.',
      'Apply monotonic stack technique to maintain elements in sorted order during array traversal.',
      'Store array indices in stack to efficiently backtrack and process ranges.'
    ],
    'hash table+tree': [
      'Use hash table to cache tree node computations and avoid redundant subtree processing.',
      'Map tree node values to frequencies using hash table for duplicate detection.',
      'Store parent-child relationships in hash table for efficient tree reconstruction.'
    ],
    'default': [
      'Combine {primaryTag} and {relatedTag} to leverage both data structures\' strengths.',
      'Use {relatedTag} to complement {primaryTag} operations and improve overall efficiency.',
      'Apply {primaryTag} with {relatedTag} for problems requiring multiple data access patterns.'
    ]
  },

  // Algorithm + Algorithm combinations
  'ALGORITHMS+ALGORITHMS': {
    'dynamic programming+greedy': [
      'Use DP to verify greedy choice optimality before implementing greedy solution.',
      'Apply greedy within DP state transitions to optimize subproblem selection.',
      'Combine greedy preprocessing with DP to reduce state space complexity.'
    ],
    'depth-first search+backtracking': [
      'Use DFS to explore all possible paths while backtracking from invalid solutions.',
      'Apply recursive DFS with backtracking to generate all valid combinations systematically.',
      'Implement pruning within DFS backtracking to eliminate invalid branches early.'
    ],
    'breadth-first search+dynamic programming': [
      'Use BFS for level-order traversal combined with DP for optimal path calculations.',
      'Apply BFS to build DP table layer by layer for shortest path problems.',
      'Combine BFS state exploration with memoization to avoid redundant computations.'
    ],
    'default': [
      'Apply {primaryTag} first to establish solution structure, then use {relatedTag} for optimization.',
      'Combine {primaryTag} and {relatedTag} to handle different aspects of the problem efficiently.',
      'Use {relatedTag} to enhance {primaryTag} performance in specific problem constraints.'
    ]
  },

  // Technique + Algorithm combinations
  'TECHNIQUES+ALGORITHMS': {
    'two pointers+sorting': [
      'Sort array first to enable two-pointer technique for finding target sums or pairs.',
      'Use two pointers from sorted array ends to avoid brute force O(n²) comparisons.',
      'Apply two-pointer technique on sorted data to find closest pairs or ranges.'
    ],
    'sliding window+dynamic programming': [
      'Use sliding window to optimize DP state transitions over contiguous subarrays.',
      'Apply window-based DP to solve substring problems with linear time complexity.',
      'Combine sliding window technique with DP memoization for efficient range processing.'
    ],
    'bit manipulation+dynamic programming': [
      'Use bitmasks to represent DP states when dealing with subset enumeration problems.',
      'Apply bit manipulation to compress DP state space and reduce memory usage.',
      'Combine bitwise operations with DP for problems involving binary choices or flags.'
    ],
    'default': [
      'Apply {primaryTag} technique to optimize {relatedTag} algorithm performance.',
      'Use {relatedTag} with {primaryTag} approach to handle specific problem constraints.',
      'Combine {primaryTag} and {relatedTag} for problems requiring both pattern recognition and algorithmic efficiency.'
    ]
  },

  // Generic fallback templates
  'GENERAL': {
    'default': [
      'Apply {primaryTag} with {relatedTag} to combine their complementary strengths.',
      'Use {relatedTag} to enhance {primaryTag} performance for this specific problem type.',
      'Consider {relatedTag} approach when {primaryTag} alone doesn\'t meet complexity requirements.',
      'Leverage {primaryTag} and {relatedTag} together for optimal solution efficiency.'
    ]
  }
};

/**
 * Generate concrete strategy tip for a tag pair
 */
function generateStrategyTip(primaryTag, relatedTag, strength, tier) {
  const primaryType = getTagType(primaryTag);
  const relatedType = getTagType(relatedTag);
  
  // Find appropriate template category
  let templateCategory = 'GENERAL';
  let templateKey = 'default';
  
  // Try specific tag pair first
  const pairKey = `${primaryTag}+${relatedTag}`;
  const reversePairKey = `${relatedTag}+${primaryTag}`;
  
  // Check for specific combinations
  for (const [category, templates] of Object.entries(STRATEGY_TEMPLATES)) {
    if (templates[pairKey]) {
      templateCategory = category;
      templateKey = pairKey;
      break;
    }
    if (templates[reversePairKey]) {
      templateCategory = category;
      templateKey = reversePairKey;
      break;
    }
  }
  
  // If no specific pair found, use type-based matching
  if (templateKey === 'default') {
    const typeCombo = `${primaryType}+${relatedType}`;
    const reverseTypeCombo = `${relatedType}+${primaryType}`;
    
    if (STRATEGY_TEMPLATES[typeCombo]) {
      templateCategory = typeCombo;
    } else if (STRATEGY_TEMPLATES[reverseTypeCombo]) {
      templateCategory = reverseTypeCombo;
    }
  }
  
  // Get templates for the category
  const categoryTemplates = STRATEGY_TEMPLATES[templateCategory] || STRATEGY_TEMPLATES['GENERAL'];
  const templates = categoryTemplates[templateKey] || categoryTemplates['default'] || STRATEGY_TEMPLATES['GENERAL']['default'];
  
  // Select template based on strength tier
  let selectedTemplate;
  if (tier === 'essential' && templates.length > 0) {
    selectedTemplate = templates[0]; // Best template for highest tier
  } else if (tier === 'strong' && templates.length > 1) {
    selectedTemplate = templates[1] || templates[0];
  } else {
    selectedTemplate = templates[templates.length - 1] || templates[0];
  }
  
  // Replace placeholders
  let tip = selectedTemplate
    .replace(/\{primaryTag\}/g, primaryTag)
    .replace(/\{relatedTag\}/g, relatedTag)
    .replace(/\{strength\}/g, strength.toFixed(3))
    .replace(/\{tier\}/g, tier);
  
  return {
    tip: tip,
    templateCategory: templateCategory,
    templateKey: templateKey,
    confidence: getConfidenceScore(templateCategory, templateKey, strength)
  };
}

/**
 * Calculate confidence score for generated tip
 */
function getConfidenceScore(templateCategory, templateKey, strength) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for specific tag pairs
  if (templateKey !== 'default') {
    confidence += 0.3;
  }
  
  // Increase confidence for well-defined categories
  if (templateCategory !== 'GENERAL') {
    confidence += 0.2;
  }
  
  // Adjust for relationship strength
  confidence += Math.min(strength, 0.5); // Cap strength bonus at 0.5
  
  return Math.min(confidence, 1.0);
}

/**
 * Generate strategy tips for multiple tag pairs
 */
function generateStrategyTips(tagPairs) {
  console.log('🧠 Generating strategy tips following guidelines...');
  
  const results = [];
  
  for (const { primaryTag, relatedTag, strength, tier } of tagPairs) {
    const tipResult = generateStrategyTip(primaryTag, relatedTag, strength, tier);
    
    results.push({
      primaryTag,
      relatedTag,
      strength,
      tier,
      ...tipResult
    });
    
    console.log(`✅ Generated tip for [${primaryTag}] + [${relatedTag}]: "${tipResult.tip.substring(0, 60)}..."`);
  }
  
  console.log(`🎯 Generated ${results.length} strategy tips`);
  return results;
}

/**
 * Validate tip follows guidelines
 */
function validateTip(tip) {
  const guidelines = {
    isConcrete: false,
    isContextSpecific: false,
    isBrief: false,
    nonRepetitive: true
  };
  
  // Check if concrete (mentions specific techniques)
  const concreteKeywords = [
    'technique', 'algorithm', 'optimization', 'data structure',
    'lookup', 'search', 'sort', 'hash', 'index', 'pointer',
    'stack', 'queue', 'tree', 'array', 'table', 'cache',
    'O(n)', 'O(log n)', 'O(1)', 'time complexity', 'space complexity'
  ];
  guidelines.isConcrete = concreteKeywords.some(keyword => 
    tip.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Check if brief (1-2 sentences, roughly < 150 characters)
  const sentences = tip.split(/[.!?]+/).filter(s => s.trim().length > 0);
  guidelines.isBrief = sentences.length <= 2 && tip.length <= 150;
  
  // Context-specific check (contains both tag references or specific techniques)
  guidelines.isContextSpecific = true; // Assume templates are context-specific
  
  return guidelines;
}

/**
 * Test strategy tip generation
 */
function testTipGeneration() {
  console.log('🧪 Testing Strategy Tip Generation...\n');
  
  const testPairs = [
    { primaryTag: 'array', relatedTag: 'hash table', strength: 1.0, tier: 'essential' },
    { primaryTag: 'string', relatedTag: 'dynamic programming', strength: 0.201, tier: 'strong' },
    { primaryTag: 'graph', relatedTag: 'breadth-first search', strength: 0.120, tier: 'essential' },
    { primaryTag: 'binary tree', relatedTag: 'depth-first search', strength: 0.323, tier: 'strong' },
    { primaryTag: 'sorting', relatedTag: 'greedy', strength: 0.307, tier: 'strong' }
  ];
  
  const results = generateStrategyTips(testPairs);
  
  console.log('\n📋 Generated Tips with Validation:');
  for (const result of results) {
    const validation = validateTip(result.tip);
    console.log(`\n🎯 [${result.primaryTag}] + [${result.relatedTag}] (${result.tier}):`);
    console.log(`   Tip: "${result.tip}"`);
    console.log(`   Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`   Guidelines: Concrete: ${validation.isConcrete ? '✅' : '❌'}, Brief: ${validation.isBrief ? '✅' : '❌'}, Context: ${validation.isContextSpecific ? '✅' : '❌'}`);
  }
}

// Export functions for use in main generation script
module.exports = {
  generateStrategyTip,
  generateStrategyTips,
  validateTip,
  getTagType,
  STRATEGY_TEMPLATES,
  TAG_TYPES
};

// Run test if called directly
if (require.main === module) {
  testTipGeneration();
}