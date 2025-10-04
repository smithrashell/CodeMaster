// Tag relationships data structure for learning path visualization
export const tagRelationships = {
  'array': {
    prerequisites: [],
    unlocks: [
      { tag: 'hash table', weight: 85, description: 'Arrays are fundamental for hash table implementations' },
      { tag: 'two pointers', weight: 90, description: 'Array manipulation is core to two-pointer techniques' }
    ],
    position: { x: 100, y: 200 }
  },
  'hash table': {
    prerequisites: ['array'],
    unlocks: [
      { tag: 'string', weight: 75, description: 'Hash tables optimize string processing algorithms' },
      { tag: 'dynamic programming', weight: 60, description: 'Hash tables help memoization in DP solutions' }
    ],
    position: { x: 250, y: 150 }
  },
  'two pointers': {
    prerequisites: ['array'],
    unlocks: [
      { tag: 'binary search', weight: 70, description: 'Two pointers help understand binary search mechanics' },
      { tag: 'sliding window', weight: 95, description: 'Sliding window is an advanced two-pointer pattern' }
    ],
    position: { x: 250, y: 250 }
  },
  'string': {
    prerequisites: ['hash table'],
    unlocks: [
      { tag: 'dynamic programming', weight: 80, description: 'String DP problems are common and build on string fundamentals' }
    ],
    position: { x: 400, y: 100 }
  },
  'binary search': {
    prerequisites: ['two pointers'],
    unlocks: [
      { tag: 'tree', weight: 85, description: 'Binary search concepts apply directly to tree traversal' }
    ],
    position: { x: 400, y: 200 }
  },
  'sliding window': {
    prerequisites: ['two pointers'],
    unlocks: [
      { tag: 'dynamic programming', weight: 65, description: 'Some DP problems use sliding window optimizations' }
    ],
    position: { x: 400, y: 300 }
  },
  'dynamic programming': {
    prerequisites: ['string', 'hash table', 'sliding window'],
    unlocks: [
      { tag: 'graph', weight: 75, description: 'Graph DP problems combine both concepts effectively' }
    ],
    position: { x: 550, y: 200 }
  },
  'stack': { 
    prerequisites: [], 
    unlocks: [
      { tag: 'tree', weight: 80, description: 'Stack-based tree traversal is essential for tree mastery' },
      { tag: 'graph', weight: 70, description: 'DFS in graphs commonly uses stack data structure' }
    ], 
    position: { x: 100, y: 350 } 
  },
  'queue': { 
    prerequisites: ['stack'], 
    unlocks: [
      { tag: 'tree', weight: 75, description: 'BFS tree traversal requires queue understanding' },
      { tag: 'graph', weight: 85, description: 'BFS graph algorithms are queue-dependent' }
    ], 
    position: { x: 250, y: 350 } 
  },
  'tree': {
    prerequisites: ['binary search', 'stack'],
    unlocks: [
      { tag: 'graph', weight: 90, description: 'Trees are specialized graphs - direct skill transfer' }
    ],
    position: { x: 400, y: 400 }
  },
  'graph': {
    prerequisites: ['dynamic programming', 'tree', 'queue'],
    unlocks: [],
    position: { x: 700, y: 300 }
  },
  'doubly-linked-list': {
    prerequisites: [],
    unlocks: [],
    position: { x: 100, y: 500 }
  },
  'breadth-first-search': {
    prerequisites: ['queue', 'tree'],
    unlocks: [
      { tag: 'graph', weight: 85, description: 'BFS is fundamental for graph traversal' }
    ],
    position: { x: 400, y: 500 }
  },
  'depth-first-search': {
    prerequisites: ['stack', 'tree'],
    unlocks: [
      { tag: 'graph', weight: 85, description: 'DFS is fundamental for graph traversal' }
    ],
    position: { x: 550, y: 500 }
  }
};