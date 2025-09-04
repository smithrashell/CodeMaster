import { dbHelper } from "./index.js";
import STRATEGY_DATA from "../constants/strategy_data.json";

const openDB = dbHelper.openDB;

/**
 * Get strategy data for a specific tag from IndexedDB
 * @param {string} tag - The tag name
 * @returns {Promise<Object|null>} Strategy data or null
 */
// In-memory cache for database results to prevent repeated IndexedDB access
const strategyCache = new Map();
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

export async function getStrategyForTag(tag) {
  try {
    // eslint-disable-next-line no-console
    console.log(`📊 DB DEBUG: Starting ultra-fast query for tag "${tag}"`);

    // Check cache first
    const cacheKey = tag.toLowerCase();
    const cached = strategyCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      // eslint-disable-next-line no-console
      console.log(`💾 DB DEBUG: Using in-memory cache for "${tag}"`);
      return cached.data;
    }

    const db = await openDB();
    if (!db) {
      console.warn(`⚠️ DB DEBUG: IndexedDB not available for "${tag}"`);
      return null;
    }

    // Test with extended timeout to diagnose if operations complete
    const result = await new Promise((resolve) => {
      let completed = false;

      // Long timeout to see if operation actually completes
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          // eslint-disable-next-line no-console
          console.log(
            `⚡ DB DEBUG: Database timeout for "${tag}" after 30s - resolving null`
          );
          resolve(null);
        }
      }, 30000);

      try {
        const transaction = db.transaction(["strategy_data"], "readonly");
        const store = transaction.objectStore("strategy_data");
        const request = store.get(tag);

        request.onsuccess = (event) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);

            const dbResult = event.target.result;
            // eslint-disable-next-line no-console
            console.log(
              `⚡ DB DEBUG: Database success for "${tag}":`,
              dbResult ? "FOUND" : "NOT FOUND"
            );

            // Cache the result (including null results to prevent repeated queries)
            strategyCache.set(cacheKey, {
              data: dbResult || null,
              expiry: Date.now() + CACHE_EXPIRY_TIME,
            });

            resolve(dbResult || null);
          }
        };

        // Combine all error handlers for faster resolution
        const handleError = () => {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            // eslint-disable-next-line no-console
            console.warn(
              `⚡ DB DEBUG: Database error for "${tag}" - resolving null`
            );

            // Cache null result to prevent repeated failed queries
            strategyCache.set(cacheKey, {
              data: null,
              expiry: Date.now() + CACHE_EXPIRY_TIME / 10, // Shorter cache for errors
            });

            resolve(null);
          }
        };

        request.onerror = handleError;
        transaction.onerror = handleError;
        transaction.onabort = handleError;
      } catch (error) {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          console.warn(
            `⚡ DB DEBUG: Database exception for "${tag}":`,
            error.message
          );
          resolve(null);
        }
      }
    });

    return result;
  } catch (error) {
    console.warn(
      `⚡ DB DEBUG: Ultra-fast outer error for "${tag}":`,
      error.message
    );
    return null;
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
 * Check if strategy data is loaded in IndexedDB
 * @returns {Promise<boolean>} True if strategy data exists
 */
export async function isStrategyDataLoaded() {
  try {
    const db = await openDB();
    if (!db) return false;

    const tx = db.transaction("strategy_data", "readonly");
    const store = tx.objectStore("strategy_data");
    const request = store.count();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const count = request.result;
        console.log(`🎯 DB DEBUG: Strategy data count: ${count}`);
        resolve(count > 0);
      };
      request.onerror = () => {
        console.warn(`⚠️ DB DEBUG: Error checking strategy data`);
        resolve(false);
      };
    });
  } catch (error) {
    console.warn(
      `⚠️ DB DEBUG: Exception checking strategy data:`,
      error.message
    );
    return false;
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
        console.log(
          "🔍 DB DIAGNOSTIC: GetAll request success, result count:",
          getAllRequest.result.length
        );
        console.log(
          "🔍 DB DIAGNOSTIC: First 5 strategies:",
          getAllRequest.result.slice(0, 5).map((s) => s.tag)
        );
        resolve(getAllRequest.result);
      };
      getAllRequest.onerror = () => {
        console.error(
          "🔍 DB DIAGNOSTIC: GetAll request failed:",
          getAllRequest.error
        );
        reject(getAllRequest.error);
      };
    });

    return allStrategies.map((strategy) => strategy.tag);
  } catch (error) {
    console.error("❌ Error getting all strategy tags:", error);
    return [];
  }
}
