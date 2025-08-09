/**
 * Emergency Strategy Bypass
 * 
 * Direct fallback system that bypasses all Chrome messaging and database calls
 * when the normal strategy system is completely broken.
 */

// Enhanced fallback strategies with more comprehensive data
const EMERGENCY_STRATEGIES = {
  'array': {
    tag: 'array',
    strategy: 'Use two pointers for sorted arrays, sliding window for subarrays, binary search for searches. Consider prefix sums for range queries.',
    overview: 'Arrays store elements in contiguous memory. Key patterns: iteration, two pointers, sliding window, binary search.',
    patterns: ['Two Pointers', 'Sliding Window', 'Binary Search', 'Prefix Sum'],
    related: ['sorting', 'hash table', 'two pointers'],
    difficulty: 'Easy to Hard',
    examples: 'Two Sum, Maximum Subarray, Binary Search'
  },
  'hash table': {
    tag: 'hash table',
    strategy: 'Use HashMap for O(1) lookups, count frequencies, detect duplicates. Great for caching and memoization.',
    overview: 'Hash tables provide O(1) average-case lookup, insertion, and deletion through key-value mapping.',
    patterns: ['Frequency Count', 'Lookup Table', 'Memoization', 'Set Operations'],
    related: ['array', 'string', 'two pointers'],
    difficulty: 'Easy to Medium',
    examples: 'Two Sum, Group Anagrams, LRU Cache'
  },
  'string': {
    tag: 'string',
    strategy: 'Use two pointers for palindromes, sliding window for substrings, KMP for pattern matching, trie for multiple strings.',
    overview: 'Strings are arrays of characters. Key operations: substring, palindrome, pattern matching, manipulation.',
    patterns: ['Two Pointers', 'Sliding Window', 'Pattern Matching', 'String Manipulation'],
    related: ['hash table', 'array', 'dynamic programming'],
    difficulty: 'Easy to Hard',
    examples: 'Valid Palindrome, Longest Substring, Edit Distance'
  },
  'sorting': {
    tag: 'sorting',
    strategy: 'Sort first to enable binary search and two pointers. Use merge sort for stability, quick sort for average performance.',
    overview: 'Sorting arranges elements in order. Enables binary search, merging, and simplifies many problems.',
    patterns: ['Merge Sort', 'Quick Sort', 'Bucket Sort', 'Counting Sort'],
    related: ['array', 'divide and conquer'],
    difficulty: 'Easy to Medium',
    examples: 'Merge Intervals, Meeting Rooms, Top K Elements'
  },
  'tree': {
    tag: 'tree',
    strategy: 'Use DFS for path problems, BFS for level-order traversal. Consider tree properties: BST ordering, balanced trees.',
    overview: 'Trees are hierarchical data structures with parent-child relationships. Root, leaves, depth, height concepts.',
    patterns: ['DFS', 'BFS', 'Tree Traversal', 'Binary Search Tree'],
    related: ['depth-first search', 'breadth-first search', 'recursion'],
    difficulty: 'Medium to Hard',
    examples: 'Binary Tree Inorder, Validate BST, Lowest Common Ancestor'
  },
  'dynamic programming': {
    tag: 'dynamic programming',
    strategy: 'Identify optimal substructure and overlapping subproblems. Use memoization (top-down) or tabulation (bottom-up).',
    overview: 'DP solves complex problems by breaking them into simpler subproblems and storing results to avoid recomputation.',
    patterns: ['Memoization', 'Tabulation', '1D DP', '2D DP', 'State Machine'],
    related: ['recursion', 'array', 'string'],
    difficulty: 'Medium to Hard',
    examples: 'Fibonacci, Coin Change, Longest Common Subsequence'
  },
  'binary search': {
    tag: 'binary search',
    strategy: 'Requires sorted data. Use for search, find boundaries, or search in answer space. Template: left, right, mid.',
    overview: 'Binary search efficiently finds elements in sorted arrays with O(log n) time complexity.',
    patterns: ['Classic Binary Search', 'Search Insert Position', 'Find Peak Element'],
    related: ['array', 'sorting'],
    difficulty: 'Easy to Medium',
    examples: 'Search in Rotated Array, Find Peak Element'
  },
  'two pointers': {
    tag: 'two pointers',
    strategy: 'Use left/right pointers for sorted arrays, fast/slow for linked lists, sliding window for subarrays.',
    overview: 'Two pointers technique uses two indices to traverse data structure efficiently.',
    patterns: ['Opposite Direction', 'Same Direction', 'Fast/Slow'],
    related: ['array', 'string', 'linked list'],
    difficulty: 'Easy to Medium',
    examples: 'Two Sum II, Remove Duplicates, Cycle Detection'
  },
  'linked list': {
    tag: 'linked list',
    strategy: 'Use dummy nodes to simplify edge cases, two pointers for cycles, reverse in groups using iteration or recursion.',
    overview: 'Linked lists store data in nodes with pointers. Dynamic size but no random access.',
    patterns: ['Dummy Node', 'Two Pointers', 'Reversal', 'Merging'],
    related: ['two pointers', 'recursion'],
    difficulty: 'Easy to Medium',
    examples: 'Reverse Linked List, Merge Two Lists, Cycle Detection'
  },
  'stack': {
    tag: 'stack',
    strategy: 'LIFO structure. Use for parentheses matching, expression evaluation, monotonic stack for next greater element.',
    overview: 'Stack follows Last-In-First-Out principle. Useful for backtracking, parsing, and maintaining order.',
    patterns: ['Monotonic Stack', 'Expression Evaluation', 'Backtracking'],
    related: ['array', 'string'],
    difficulty: 'Easy to Medium',
    examples: 'Valid Parentheses, Daily Temperatures, Min Stack'
  }
};

export class EmergencyStrategyBypass {
  constructor() {
    this.isEmergencyMode = false;
    this.fallbackCount = 0;
  }

  /**
   * Enable emergency mode - bypass all normal strategy retrieval
   */
  enableEmergencyMode() {
    this.isEmergencyMode = true;
    console.warn('🚨 EMERGENCY MODE: Strategy system bypassed - using fallback strategies only');
  }

  /**
   * Disable emergency mode - restore normal operation
   */
  disableEmergencyMode() {
    this.isEmergencyMode = false;
    console.log('✅ Emergency mode disabled - normal strategy retrieval restored');
  }

  /**
   * Get strategy using only fallback data
   */
  getEmergencyStrategy(tag) {
    const normalizedTag = tag.toLowerCase().trim();
    const strategy = EMERGENCY_STRATEGIES[normalizedTag];
    
    if (strategy) {
      this.fallbackCount++;
      console.log(`🔄 EMERGENCY: Using fallback strategy for "${tag}" (${this.fallbackCount} total fallbacks)`);
      return strategy;
    }

    // Generate basic strategy if not in our emergency list
    return this.generateBasicStrategy(tag);
  }

  /**
   * Generate a basic strategy for unknown tags
   */
  generateBasicStrategy(tag) {
    console.log(`⚠️ EMERGENCY: Generating basic strategy for unknown tag "${tag}"`);
    
    return {
      tag: tag,
      strategy: `Consider the fundamental approach for ${tag} problems. Break down the problem, identify patterns, and use appropriate data structures.`,
      overview: `${tag} is a computer science concept that appears in algorithmic problems.`,
      patterns: ['Problem Analysis', 'Pattern Recognition', 'Algorithm Design'],
      related: ['problem solving', 'algorithms'],
      difficulty: 'Varies',
      examples: 'Context-dependent'
    };
  }

  /**
   * Get multiple strategies (batch operation)
   */
  getEmergencyStrategies(tags) {
    const strategies = {};
    
    tags.forEach(tag => {
      const strategy = this.getEmergencyStrategy(tag);
      if (strategy) {
        strategies[tag] = strategy;
      }
    });
    
    return strategies;
  }

  /**
   * Check if tag exists in emergency strategies
   */
  hasEmergencyStrategy(tag) {
    return !!EMERGENCY_STRATEGIES[tag.toLowerCase().trim()];
  }

  /**
   * Get all available emergency strategies
   */
  getAllEmergencyStrategies() {
    return { ...EMERGENCY_STRATEGIES };
  }

  /**
   * Get emergency statistics
   */
  getEmergencyStats() {
    return {
      isEmergencyMode: this.isEmergencyMode,
      fallbackCount: this.fallbackCount,
      availableStrategies: Object.keys(EMERGENCY_STRATEGIES).length,
      strategiesList: Object.keys(EMERGENCY_STRATEGIES)
    };
  }

  /**
   * Test emergency system
   */
  testEmergencySystem() {
    console.log('🧪 Testing emergency strategy system...');
    
    const testTags = ['array', 'hash table', 'unknown-tag'];
    const results = [];
    
    testTags.forEach(tag => {
      const start = Date.now();
      try {
        const strategy = this.getEmergencyStrategy(tag);
        results.push({
          tag,
          success: !!strategy,
          duration: Date.now() - start,
          hasData: !!strategy?.strategy
        });
      } catch (error) {
        results.push({
          tag,
          success: false,
          duration: Date.now() - start,
          error: error.message
        });
      }
    });
    
    console.log('🧪 Emergency system test results:', results);
    return results;
  }
}

// Export singleton instance
export const emergencyStrategy = new EmergencyStrategyBypass();

// Global emergency functions for console access (only in window context)
if (typeof window !== 'undefined') {
  window.enableEmergencyStrategy = () => {
    emergencyStrategy.enableEmergencyMode();
    console.log('🚨 Emergency strategy mode enabled. Extension will use fallback data only.');
  };

  window.disableEmergencyStrategy = () => {
    emergencyStrategy.disableEmergencyMode();
    console.log('✅ Emergency strategy mode disabled. Extension will try normal operation.');
  };

  window.testEmergencyStrategy = () => {
    return emergencyStrategy.testEmergencySystem();
  };

  window.getEmergencyStats = () => {
    return emergencyStrategy.getEmergencyStats();
  };
}

export default emergencyStrategy;