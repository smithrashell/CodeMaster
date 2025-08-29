#!/usr/bin/env node

/**
 * Reusable Strategy Data Generator with Natural Cutoffs
 * 
 * Creates optimized strategy_data.json using natural relationship cutoffs
 * and following specific strategy tip guidelines.
 * 
 * Usage:
 *   node generate_strategy_data.js [options]
 * 
 * Options:
 *   --relationships <path>  Path to tag_relationships.txt
 *   --tags <path>          Path to LeetCode_Tags_Combined.json  
 *   --problems <path>      Path to standard_problems.txt
 *   --base-strategy <path> Path to existing strategy_data.json (optional)
 *   --output <path>        Output file path (default: strategy_data_optimized.json)
 *   --help                 Show usage information
 */

const fs = require('fs');
const path = require('path');
const { generateStrategyTip, validateTip } = require('./strategy_tip_generator');

// Load discovered natural cutoffs
const NATURAL_CUTOFFS = require('./natural_cutoffs_config.json');

/**
 * Configuration with discovered thresholds
 */
const CONFIG = {
  // Use discovered natural thresholds
  NATURAL_THRESHOLDS: NATURAL_CUTOFFS.NATURAL_THRESHOLDS,
  
  // Strategy tip guidelines  
  TIP_GUIDELINES: {
    maxLength: 150,        // 1-2 sentences
    mustBeConcrete: true,  // Mention specific techniques
    mustBeContextual: true // Only makes sense with "when" tag
  },
  
  // Default file paths
  DEFAULT_PATHS: {
    relationships: 'c:/Users/rashe/OneDrive/Desktop/tag_relationships.txt',
    tags: 'c:/Users/rashe/OneDrive/Desktop/LeetCode_Tags_Combined.json',
    problems: 'c:/Users/rashe/OneDrive/Desktop/standard_problems.txt',
    baseStrategy: 'c:/Users/rashe/OneDrive/Desktop/strategy_data.json',
    output: 'strategy_data_optimized.json'
  }
};

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = { ...CONFIG.DEFAULT_PATHS };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--relationships':
        options.relationships = args[++i];
        break;
      case '--tags':
        options.tags = args[++i];
        break;
      case '--problems':
        options.problems = args[++i];
        break;
      case '--base-strategy':
        options.baseStrategy = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
        showUsage();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        showUsage();
        process.exit(1);
    }
  }
  
  return options;
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
📚 Strategy Data Generator with Natural Cutoffs

Usage: node generate_strategy_data.js [options]

Options:
  --relationships <path>  Path to tag_relationships.txt
  --tags <path>          Path to LeetCode_Tags_Combined.json  
  --problems <path>      Path to standard_problems.txt
  --base-strategy <path> Path to existing strategy_data.json (optional)
  --output <path>        Output file path (default: strategy_data_optimized.json)
  --help                 Show this usage information

Examples:
  # Use default paths
  node generate_strategy_data.js
  
  # Specify custom paths
  node generate_strategy_data.js \\
    --relationships /path/to/tag_relationships.txt \\
    --tags /path/to/LeetCode_Tags_Combined.json \\
    --output my_strategy_data.json

Natural Cutoffs (discovered from data):
  Tier 1 (Essential): ${CONFIG.NATURAL_THRESHOLDS.TIER_1} (top 5%)
  Tier 2 (Strong): ${CONFIG.NATURAL_THRESHOLDS.TIER_2} (top 15%)  
  Tier 3 (Meaningful): ${CONFIG.NATURAL_THRESHOLDS.TIER_3} (top 30%)
`);
}

/**
 * Load and parse tag relationships data
 */
function loadTagRelationships(relationshipsPath) {
  console.log('📊 Loading tag relationships...');
  
  try {
    const content = fs.readFileSync(relationshipsPath, 'utf8');
    const relationshipArray = JSON.parse(content);
    
    const relationships = new Map();
    let maxStrength = 0;
    
    for (const data of relationshipArray) {
      if (data.key && data.value && data.value.relatedTags) {
        const tag = data.key.toLowerCase().trim();
        const relatedTags = {};
        
        for (const [relatedTag, strength] of Object.entries(data.value.relatedTags)) {
          const normalizedRelatedTag = relatedTag.toLowerCase().trim();
          relatedTags[normalizedRelatedTag] = strength;
          maxStrength = Math.max(maxStrength, strength);
        }
        
        relationships.set(tag, {
          relatedTags,
          problemCounts: data.value.problemCounts,
          classification: data.value.classification
        });
      }
    }
    
    console.log(`✅ Loaded ${relationships.size} tags with max strength: ${maxStrength}`);
    return { relationships, maxStrength };
    
  } catch (error) {
    console.error('❌ Error loading tag relationships:', error);
    throw error;
  }
}

/**
 * Load existing strategy data if available
 */
function loadBaseStrategyData(strategyPath) {
  if (!strategyPath || !fs.existsSync(strategyPath)) {
    console.log('📋 No base strategy data provided, generating from scratch');
    return [];
  }
  
  try {
    console.log('📋 Loading base strategy data...');
    const content = fs.readFileSync(strategyPath, 'utf8');
    const strategyData = JSON.parse(content);
    
    console.log(`✅ Loaded ${strategyData.length} base strategy entries`);
    return strategyData;
    
  } catch (error) {
    console.error('❌ Error loading base strategy data:', error);
    return [];
  }
}

/**
 * Implement natural cutoff logic for hint generation
 */
function getTopTagClusters(problemTags, relationshipMap) {
  const pairs = [];
  
  for (let i = 0; i < problemTags.length; i++) {
    for (let j = i + 1; j < problemTags.length; j++) {
      const tagA = problemTags[i].toLowerCase().trim();
      const tagB = problemTags[j].toLowerCase().trim();
      
      // Get strength from relationship map
      let strength = 0;
      if (relationshipMap.has(tagA) && relationshipMap.get(tagA).relatedTags[tagB]) {
        strength = relationshipMap.get(tagA).relatedTags[tagB];
      } else if (relationshipMap.has(tagB) && relationshipMap.get(tagB).relatedTags[tagA]) {
        strength = relationshipMap.get(tagB).relatedTags[tagA];
      }
      
      // Normalize strength (assuming max strength for normalization)
      const normalizedStrength = strength / 895; // Using known max from analysis
      
      // Only include relationships above natural cutoffs
      if (normalizedStrength >= CONFIG.NATURAL_THRESHOLDS.TIER_3) {
        let tier = 'meaningful';
        if (normalizedStrength >= CONFIG.NATURAL_THRESHOLDS.TIER_1) {
          tier = 'essential';
        } else if (normalizedStrength >= CONFIG.NATURAL_THRESHOLDS.TIER_2) {
          tier = 'strong';
        }
        
        pairs.push({
          primaryTag: tagA,
          relatedTag: tagB,
          strength: normalizedStrength,
          tier: tier
        });
      }
    }
  }
  
  // Sort by strength descending - natural ordering without arbitrary limits
  pairs.sort((a, b) => b.strength - a.strength);
  
  return pairs;
}

/**
 * Generate strategy entries for all tags using natural cutoffs
 */
function generateOptimizedStrategyData(relationshipMap, baseStrategyData, maxStrength) {
  console.log('🧠 Generating optimized strategy data with natural cutoffs...');
  
  const optimizedData = [];
  const baseStrategyMap = new Map();
  
  // Create lookup for base strategy data
  for (const entry of baseStrategyData) {
    baseStrategyMap.set(entry.tag.toLowerCase().trim(), entry);
  }
  
  // Process each tag with relationships
  for (const [tag, data] of relationshipMap) {
    const baseStrategy = baseStrategyMap.get(tag);
    
    // Get all related tags for this tag
    const relatedTagsArray = Object.keys(data.relatedTags);
    const problemTags = [tag, ...relatedTagsArray];
    
    // Use natural cutoff logic to get meaningful relationships
    const topClusters = getTopTagClusters(problemTags, relationshipMap);
    
    // Filter to only relationships involving this tag
    const relevantClusters = topClusters.filter(cluster => 
      cluster.primaryTag === tag || cluster.relatedTag === tag
    );
    
    // Generate dynamic strategies
    const dynamicStrategies = [];
    const usedTags = new Set();
    
    for (const cluster of relevantClusters) {
      const otherTag = cluster.primaryTag === tag ? cluster.relatedTag : cluster.primaryTag;
      
      if (usedTags.has(otherTag)) continue;
      usedTags.add(otherTag);
      
      // Generate strategy tip following guidelines
      const tipResult = generateStrategyTip(tag, otherTag, cluster.strength, cluster.tier);
      const validation = validateTip(tipResult.tip);
      
      // Only include tips that meet guidelines
      if (validation.isConcrete && validation.isBrief) {
        dynamicStrategies.push({
          when: otherTag,
          tip: tipResult.tip,
          strength: cluster.strength,
          tier: cluster.tier,
          confidence: tipResult.confidence
        });
      }
    }
    
    // Create optimized entry
    const optimizedEntry = {
      tag: tag,
      overview: baseStrategy?.overview || `Algorithmic approach involving ${tag} for efficient problem solving.`,
      patterns: baseStrategy?.patterns || [],
      related: baseStrategy?.related || [],
      strategy: baseStrategy?.strategy || `Apply ${tag} techniques to solve problems efficiently with optimal time and space complexity.`,
      strategies: dynamicStrategies,
      metadata: {
        problemCounts: data.problemCounts || { easy: 0, medium: 0, hard: 0 },
        classification: data.classification || "Fundamental Technique",
        totalRelationships: Object.keys(data.relatedTags).length,
        strongRelationships: dynamicStrategies.length,
        generatedAt: new Date().toISOString()
      }
    };
    
    optimizedData.push(optimizedEntry);
  }
  
  console.log(`✅ Generated ${optimizedData.length} optimized strategy entries`);
  console.log(`📊 Average strategies per tag: ${(optimizedData.reduce((sum, entry) => sum + entry.strategies.length, 0) / optimizedData.length).toFixed(1)}`);
  
  return optimizedData;
}

/**
 * Generate statistics about the optimized data
 */
function generateStatistics(optimizedData) {
  const stats = {
    totalTags: optimizedData.length,
    totalStrategies: optimizedData.reduce((sum, entry) => sum + entry.strategies.length, 0),
    tierDistribution: { essential: 0, strong: 0, meaningful: 0 },
    avgStrategiesPerTag: 0,
    guidanceCompliance: { concrete: 0, brief: 0, contextual: 0 }
  };
  
  for (const entry of optimizedData) {
    for (const strategy of entry.strategies) {
      stats.tierDistribution[strategy.tier]++;
      
      const validation = validateTip(strategy.tip);
      if (validation.isConcrete) stats.guidanceCompliance.concrete++;
      if (validation.isBrief) stats.guidanceCompliance.brief++;
      if (validation.isContextSpecific) stats.guidanceCompliance.contextual++;
    }
  }
  
  stats.avgStrategiesPerTag = (stats.totalStrategies / stats.totalTags).toFixed(1);
  
  return stats;
}

/**
 * Write optimized strategy data to file
 */
function writeOptimizedData(optimizedData, outputPath) {
  console.log('💾 Writing optimized strategy data...');
  
  try {
    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        naturalCutoffs: CONFIG.NATURAL_THRESHOLDS,
        totalEntries: optimizedData.length,
        description: "Strategy data generated using natural relationship cutoffs and guideline-compliant tips"
      },
      strategies: optimizedData
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✅ Optimized strategy data written to: ${outputPath}`);
    
    return output;
    
  } catch (error) {
    console.error('❌ Error writing optimized data:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Strategy Data Generation with Natural Cutoffs...\n');
  
  try {
    // Parse command line arguments
    const options = parseArguments();
    
    console.log('📁 Using file paths:');
    console.log(`   Relationships: ${options.relationships}`);
    console.log(`   Output: ${options.output}\n`);
    
    // Step 1: Load tag relationships
    const { relationships, maxStrength } = loadTagRelationships(options.relationships);
    
    // Step 2: Load base strategy data (optional)
    const baseStrategyData = loadBaseStrategyData(options.baseStrategy);
    
    // Step 3: Generate optimized strategy data using natural cutoffs
    const optimizedData = generateOptimizedStrategyData(relationships, baseStrategyData, maxStrength);
    
    // Step 4: Generate statistics
    const stats = generateStatistics(optimizedData);
    
    // Step 5: Write output file
    const output = writeOptimizedData(optimizedData, options.output);
    
    // Step 6: Display results
    console.log('\n📊 Generation Statistics:');
    console.log('========================');
    console.log(`📋 Total Tags: ${stats.totalTags}`);
    console.log(`🎯 Total Strategies: ${stats.totalStrategies}`);
    console.log(`📈 Average Strategies per Tag: ${stats.avgStrategiesPerTag}`);
    console.log('\n🏆 Tier Distribution:');
    console.log(`   Essential (${CONFIG.NATURAL_THRESHOLDS.TIER_1}+): ${stats.tierDistribution.essential}`);
    console.log(`   Strong (${CONFIG.NATURAL_THRESHOLDS.TIER_2}+): ${stats.tierDistribution.strong}`);
    console.log(`   Meaningful (${CONFIG.NATURAL_THRESHOLDS.TIER_3}+): ${stats.tierDistribution.meaningful}`);
    console.log('\n✅ Guideline Compliance:');
    console.log(`   Concrete: ${stats.guidanceCompliance.concrete}/${stats.totalStrategies} (${((stats.guidanceCompliance.concrete/stats.totalStrategies)*100).toFixed(1)}%)`);
    console.log(`   Brief: ${stats.guidanceCompliance.brief}/${stats.totalStrategies} (${((stats.guidanceCompliance.brief/stats.totalStrategies)*100).toFixed(1)}%)`);
    console.log(`   Contextual: ${stats.guidanceCompliance.contextual}/${stats.totalStrategies} (${((stats.guidanceCompliance.contextual/stats.totalStrategies)*100).toFixed(1)}%)`);
    
    console.log('\n🎉 Strategy data generation completed successfully!');
    console.log(`📁 Output file: ${options.output}`);
    
  } catch (error) {
    console.error('\n❌ Strategy data generation failed:', error);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  CONFIG,
  getTopTagClusters,
  generateOptimizedStrategyData,
  loadTagRelationships,
  parseArguments,
  main
};

// Run if called directly
if (require.main === module) {
  main();
}