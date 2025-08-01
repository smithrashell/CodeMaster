import { dbHelper } from "../db/index.js";
import strategyDataFile from "../constants/strategy_data.json";

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
      
      for (const tag of tags) {
        const strategy = await this.getStrategyForTag(tag);
        if (strategy) {
          strategies[tag] = strategy;
        }
      }

      return strategies;

    } catch (error) {
      console.error("❌ Error getting strategies for tags:", error);
      return {};
    }
  }

  /**
   * Get context-aware strategies for hint panel
   * @param {string[]} problemTags - Tags associated with current problem
   * @returns {Object[]} Array of relevant strategy hints
   */
  static async getContextualHints(problemTags) {
    try {
      if (!problemTags || problemTags.length === 0) {
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
        if (strategyData.strategies && problemTags.length > 1) {
          for (const strategyEntry of strategyData.strategies) {
            // Check if the related tag is also in the problem tags
            if (problemTags.includes(strategyEntry.when)) {
              hints.push({
                type: 'contextual',
                primaryTag: primaryTag,
                relatedTag: strategyEntry.when,
                tip: strategyEntry.tip,
                relevance: 1.5 // Higher relevance for multi-tag strategies
              });
            }
          }
        }
      }

      // Sort by relevance (contextual hints first, then general)
      hints.sort((a, b) => b.relevance - a.relevance);

      return hints;

    } catch (error) {
      console.error("❌ Error getting contextual hints:", error);
      return [];
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