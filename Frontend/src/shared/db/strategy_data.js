import { dbHelper } from "./index.js";
import STRATEGY_DATA from "../constants/strategy_data.json";

const openDB = dbHelper.openDB;

/**
 * Get strategy data for a specific tag from IndexedDB
 * @param {string} tag - The tag name
 * @returns {Promise<Object|null>} Strategy data or null
 */
export async function getStrategyForTag(tag) {
  try {
    // eslint-disable-next-line no-console
    console.log(`📊 DB DEBUG: Starting optimized query for tag "${tag}"`);
    
    const db = await openDB();
    if (!db) throw new Error("❌ Failed to open IndexedDB.");

    // Simplified, more reliable approach
    return new Promise((resolve, reject) => {
      let completed = false;
      
      // Set up timeout first
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          // eslint-disable-next-line no-console
          console.log(`⏱️ DB DEBUG: Query timeout for "${tag}" - using fast resolution`);
          resolve(null); // Resolve with null instead of rejecting to prevent hanging
        }
      }, 3000); // Reduced timeout to 3 seconds
      
      try {
        const transaction = db.transaction(["strategy_data"], "readonly");
        const store = transaction.objectStore("strategy_data");
        const request = store.get(tag);

        request.onsuccess = (event) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            
            const result = event.target.result;
            // eslint-disable-next-line no-console
            console.log(`📊 DB DEBUG: Fast query success for "${tag}":`, result ? 'FOUND' : 'NOT FOUND');
            
            resolve(result || null);
          }
        };

        request.onerror = (event) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            console.error(`❌ Query error for "${tag}":`, event.target.error);
            resolve(null); // Resolve with null instead of rejecting
          }
        };

        // Handle transaction errors
        transaction.onerror = (event) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            console.error(`❌ Transaction error for "${tag}":`, event.target.error);
            resolve(null); // Resolve with null instead of rejecting
          }
        };

      } catch (error) {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          console.error(`❌ Transaction setup error for "${tag}":`, error);
          resolve(null); // Resolve with null instead of rejecting
        }
      }
    });
    
  } catch (error) {
    console.error(`❌ Database connection error for "${tag}":`, error);
    return null; // Return null instead of throwing
  }
}

/**
 * Get all strategy data from IndexedDB
 * @returns {Promise<Array>} All strategy entries
 */
export async function getAllStrategies() {
  try {
    const db = await openDB();
    const tx = db.transaction("strategy_data", "readonly");
    const store = tx.objectStore("strategy_data");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("❌ Error getting all strategies:", error);
    return [];
  }
}

/**
 * Insert strategy data into IndexedDB (mimics insertStandardProblems)
 * @returns {Promise<void>}
 */
export async function insertStrategyData() {
  try {
    console.log("📊 Checking strategy data...");
    
    const db = await openDB();
    const tx = db.transaction("strategy_data", "readwrite");
    const store = tx.objectStore("strategy_data");

    // Check if data already exists
    const existing = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (existing.length > 0) {
      console.log("📊 strategy_data already seeded.");
      return existing.length;
    }

    console.log(`📊 Inserting ${STRATEGY_DATA.length} strategy entries...`);

    // Insert all strategy data
    await Promise.all(
      STRATEGY_DATA.map((strategyEntry) => {
        return new Promise((resolve, reject) => {
          console.log("📊 Inserting strategy for tag:", strategyEntry.tag);
          const req = store.put(strategyEntry);
          req.onsuccess = resolve;
          req.onerror = () => reject(req.error);
        });
      })
    );

    console.log(`✅ Inserted ${STRATEGY_DATA.length} strategy entries.`);
    return STRATEGY_DATA.length;
  } catch (error) {
    console.error("❌ Error inserting strategy data:", error);
    throw error;
  }
}

/**
 * Check if strategy data is loaded in IndexedDB
 * @returns {Promise<boolean>}
 */
export async function isStrategyDataLoaded() {
  try {
    // eslint-disable-next-line no-console
    console.log("🔍 DB DIAGNOSTIC: Checking if strategy data is loaded...");
    
    const db = await openDB();
    const tx = db.transaction("strategy_data", "readonly");
    const store = tx.objectStore("strategy_data");

    const count = await new Promise((resolve, reject) => {
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        // eslint-disable-next-line no-console
        console.log("🔍 DB DIAGNOSTIC: Count request success, result:", countRequest.result);
        resolve(countRequest.result);
      };
      countRequest.onerror = () => {
        console.error("🔍 DB DIAGNOSTIC: Count request failed:", countRequest.error);
        reject(countRequest.error);
      };
    });

    // eslint-disable-next-line no-console
    console.log("🔍 DB DIAGNOSTIC: Strategy data count:", count);
    return count > 0;
  } catch (error) {
    console.error("❌ Error checking strategy data:", error);
    return false;
  }
}

/**
 * Debug function to get all strategy tags
 * @returns {Promise<string[]>} Array of all strategy tags
 */
export async function getAllStrategyTags() {
  try {
    // eslint-disable-next-line no-console
    console.log("🔍 DB DIAGNOSTIC: Getting all strategy tags...");
    
    const db = await openDB();
    const tx = db.transaction("strategy_data", "readonly");
    const store = tx.objectStore("strategy_data");

    const allStrategies = await new Promise((resolve, reject) => {
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        // eslint-disable-next-line no-console
        console.log("🔍 DB DIAGNOSTIC: GetAll request success, result count:", getAllRequest.result.length);
        console.log("🔍 DB DIAGNOSTIC: First 5 strategies:", getAllRequest.result.slice(0, 5).map(s => s.tag));
        resolve(getAllRequest.result);
      };
      getAllRequest.onerror = () => {
        console.error("🔍 DB DIAGNOSTIC: GetAll request failed:", getAllRequest.error);
        reject(getAllRequest.error);
      };
    });

    return allStrategies.map(strategy => strategy.tag);
  } catch (error) {
    console.error("❌ Error getting all strategy tags:", error);
    return [];
  }
}