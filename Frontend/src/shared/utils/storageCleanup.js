/**
 * Storage Quota Management and Cleanup Utilities for CodeMaster
 * 
 * Provides automated and manual cleanup strategies for both IndexedDB and Chrome Storage
 * to prevent quota exceeded errors and maintain optimal storage performance.
 */

import { dbHelper } from '../db/index.js';
import { ChromeAPIErrorHandler } from '../services/ChromeAPIErrorHandler.js';
import ErrorReportService from '../services/ErrorReportService.js';

export class StorageCleanupManager {
  // Cleanup strategies
  static CLEANUP_STRATEGY = {
    AGGRESSIVE: 'aggressive',
    MODERATE: 'moderate', 
    CONSERVATIVE: 'conservative',
    CUSTOM: 'custom'
  };

  // Age thresholds for different cleanup strategies (in days)
  static AGE_THRESHOLDS = {
    AGGRESSIVE: {
      sessions: 7,
      attempts: 14,
      analytics: 30,
      errors: 7,
      backups: 3
    },
    MODERATE: {
      sessions: 30,
      attempts: 60,
      analytics: 90,
      errors: 30,
      backups: 7
    },
    CONSERVATIVE: {
      sessions: 90,
      attempts: 180,
      analytics: 365,
      errors: 60,
      backups: 14
    }
  };

  // Cleanup priorities (higher number = higher priority)
  static CLEANUP_PRIORITIES = {
    error_reports: 1,
    backup_storage: 2,
    session_analytics: 3,
    old_attempts: 4,
    old_sessions: 5,
    temp_data: 6
  };

  /**
   * Perform automatic cleanup based on storage health
   */
  static async performAutomaticCleanup(targetFreeSpace = 0.2) { // 20% free space
    try {
      console.log('Starting automatic storage cleanup');
      
      const cleanupResults = {
        timestamp: new Date().toISOString(),
        indexedDB: await this.cleanupIndexedDB(targetFreeSpace),
        chromeStorage: await this.cleanupChromeStorage(targetFreeSpace),
        totalFreedBytes: 0,
        success: true
      };

      cleanupResults.totalFreedBytes = 
        cleanupResults.indexedDB.freedBytes + 
        cleanupResults.chromeStorage.freedBytes;

      console.log('Automatic cleanup completed:', cleanupResults);
      return cleanupResults;

    } catch (error) {
      console.error('Automatic cleanup failed:', error);
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        success: false,
        totalFreedBytes: 0
      };
    }
  }

  /**
   * IndexedDB cleanup operations
   */
  static async cleanupIndexedDB(targetFreeSpace = 0.2, strategy = this.CLEANUP_STRATEGY.MODERATE) {
    const results = {
      freedBytes: 0,
      cleanedStores: {},
      errors: {}
    };

    try {
      const db = await dbHelper.openDB();
      const ageThresholds = this.AGE_THRESHOLDS[strategy];

      // Cleanup each store based on priority and age
      const storesToClean = [
        { name: 'session_analytics', priority: 3, ageField: 'completedAt' },
        { name: 'attempts', priority: 4, ageField: 'date' },
        { name: 'sessions', priority: 5, ageField: 'Date' },
        { name: 'backup_storage', priority: 2, ageField: 'timestamp' },
        { name: 'error_reports', priority: 1, ageField: 'timestamp' }
      ];

      for (const storeConfig of storesToClean) {
        try {
          if (db.objectStoreNames.contains(storeConfig.name)) {
            const cleanupResult = await this.cleanupStore(
              db, 
              storeConfig.name, 
              ageThresholds[storeConfig.name] || ageThresholds.sessions,
              storeConfig.ageField
            );
            
            results.cleanedStores[storeConfig.name] = cleanupResult;
            results.freedBytes += cleanupResult.estimatedFreedBytes;
          }
        } catch (error) {
          console.warn(`Failed to cleanup store ${storeConfig.name}:`, error);
          results.errors[storeConfig.name] = error.message;
        }
      }

      // Additional cleanup for specific data patterns
      await this.cleanupDuplicateAttempts(db, results);
      await this.cleanupIncompleteData(db, results);

    } catch (error) {
      console.error('IndexedDB cleanup failed:', error);
      results.errors.general = error.message;
    }

    return results;
  }

  /**
   * Chrome Storage cleanup operations
   */
  static async cleanupChromeStorage(targetFreeSpace = 0.2) {
    const results = {
      freedBytes: 0,
      cleanedKeys: [],
      errors: {}
    };

    try {
      // Get all Chrome Storage data
      const allData = await ChromeAPIErrorHandler.storageGetWithRetry(null);
      const dataEntries = Object.entries(allData);

      // Calculate current usage
      const totalSize = JSON.stringify(allData).length;
      const targetSize = totalSize * (1 - targetFreeSpace);

      if (totalSize <= targetSize) {
        console.log('Chrome Storage already has sufficient free space');
        return results;
      }

      // Sort entries by cleanup priority
      const prioritizedEntries = this.prioritizeChromeStorageEntries(dataEntries);
      let currentSize = totalSize;

      for (const [key, value] of prioritizedEntries) {
        if (currentSize <= targetSize) break;

        try {
          const entrySize = JSON.stringify({ [key]: value }).length;
          
          // Remove the entry
          await new Promise((resolve) => {
            chrome.storage.local.remove([key], () => resolve());
          });

          results.cleanedKeys.push(key);
          results.freedBytes += entrySize;
          currentSize -= entrySize;

        } catch (error) {
          console.warn(`Failed to remove Chrome Storage key ${key}:`, error);
          results.errors[key] = error.message;
        }
      }

    } catch (error) {
      console.error('Chrome Storage cleanup failed:', error);
      results.errors.general = error.message;
    }

    return results;
  }

  /**
   * Cleanup specific IndexedDB store based on age
   */
  static async cleanupStore(db, storeName, maxAgeDays, ageField = 'timestamp') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const result = {
      deletedCount: 0,
      estimatedFreedBytes: 0,
      errors: []
    };

    try {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Get all data to filter by age
      const allData = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Filter old items
      const oldItems = allData.filter(item => {
        const itemDate = this.extractDate(item, ageField);
        return itemDate && itemDate < cutoffDate;
      });

      // Delete old items
      for (const item of oldItems) {
        try {
          await new Promise((resolve, reject) => {
            const keyPath = store.keyPath;
            const key = keyPath ? item[keyPath] : item.id;
            const deleteRequest = store.delete(key);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });

          result.deletedCount++;
          result.estimatedFreedBytes += JSON.stringify(item).length;
        } catch (deleteError) {
          result.errors.push(`Failed to delete item: ${deleteError.message}`);
        }
      }

    } catch (error) {
      result.errors.push(`Store cleanup failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Cleanup duplicate attempts (same problem, same session, within short time window)
   */
  static async cleanupDuplicateAttempts(db, results) {
    try {
      if (!db.objectStoreNames.contains('attempts')) return;

      const transaction = db.transaction(['attempts'], 'readwrite');
      const store = transaction.objectStore('attempts');

      const allAttempts = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Group attempts by problemId and sessionId
      const grouped = {};
      allAttempts.forEach(attempt => {
        const key = `${attempt.problemId}_${attempt.sessionId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(attempt);
      });

      let duplicatesRemoved = 0;
      let duplicatesSize = 0;

      // Remove duplicates (keep the latest one)
      for (const [key, attempts] of Object.entries(grouped)) {
        if (attempts.length > 1) {
          // Sort by date and keep the most recent
          attempts.sort((a, b) => new Date(b.date) - new Date(a.date));
          const duplicates = attempts.slice(1); // All except the first (most recent)

          for (const duplicate of duplicates) {
            try {
              await new Promise((resolve, reject) => {
                const deleteRequest = store.delete(duplicate.id);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
              });
              duplicatesRemoved++;
              duplicatesSize += JSON.stringify(duplicate).length;
            } catch (error) {
              console.warn('Failed to delete duplicate attempt:', error);
            }
          }
        }
      }

      if (duplicatesRemoved > 0) {
        results.cleanedStores.duplicate_attempts = {
          deletedCount: duplicatesRemoved,
          estimatedFreedBytes: duplicatesSize
        };
        results.freedBytes += duplicatesSize;
      }

    } catch (error) {
      console.warn('Duplicate attempts cleanup failed:', error);
      results.errors.duplicate_cleanup = error.message;
    }
  }

  /**
   * Cleanup incomplete or corrupted data
   */
  static async cleanupIncompleteData(db, results) {
    try {
      const storesToValidate = ['sessions', 'attempts', 'settings'];
      let incompleteRemoved = 0;
      let incompleteSize = 0;

      for (const storeName of storesToValidate) {
        if (!db.objectStoreNames.contains(storeName)) continue;

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const allData = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        // Validate and remove incomplete data
        for (const item of allData) {
          if (!this.validateDataIntegrity(storeName, item)) {
            try {
              const keyPath = store.keyPath;
              const key = keyPath ? item[keyPath] : item.id;
              
              await new Promise((resolve, reject) => {
                const deleteRequest = store.delete(key);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
              });

              incompleteRemoved++;
              incompleteSize += JSON.stringify(item).length;
            } catch (error) {
              console.warn('Failed to delete incomplete data:', error);
            }
          }
        }
      }

      if (incompleteRemoved > 0) {
        results.cleanedStores.incomplete_data = {
          deletedCount: incompleteRemoved,
          estimatedFreedBytes: incompleteSize
        };
        results.freedBytes += incompleteSize;
      }

    } catch (error) {
      console.warn('Incomplete data cleanup failed:', error);
      results.errors.incomplete_cleanup = error.message;
    }
  }

  /**
   * Prioritize Chrome Storage entries for cleanup
   */
  static prioritizeChromeStorageEntries(dataEntries) {
    return dataEntries.sort(([keyA, valueA], [keyB, valueB]) => {
      // Temporary keys have highest cleanup priority
      if (keyA.startsWith('temp_') && !keyB.startsWith('temp_')) return -1;
      if (keyB.startsWith('temp_') && !keyA.startsWith('temp_')) return 1;

      // Error reports can be cleaned up readily
      if (keyA.includes('error') && !keyB.includes('error')) return -1;
      if (keyB.includes('error') && !keyA.includes('error')) return 1;

      // Backup data is less critical than settings
      if (keyA.includes('backup') && keyB.includes('settings')) return -1;
      if (keyB.includes('backup') && keyA.includes('settings')) return 1;

      // By size (larger items first)
      const sizeA = JSON.stringify(valueA).length;
      const sizeB = JSON.stringify(valueB).length;
      return sizeB - sizeA;
    });
  }

  /**
   * Extract date from data item
   */
  static extractDate(item, ageField) {
    if (!item || typeof item !== 'object') return null;

    const dateValue = item[ageField] || item.timestamp || item.date || item.createdAt;
    if (!dateValue) return null;

    return new Date(dateValue);
  }

  /**
   * Validate data integrity
   */
  static validateDataIntegrity(storeName, item) {
    if (!item || typeof item !== 'object') return false;

    switch (storeName) {
      case 'sessions':
        return !!(item.id && item.Date);
      case 'attempts':
        return !!(item.id && item.problemId && item.sessionId);
      case 'settings':
        return !!(item.id && item.data);
      default:
        return true; // Pass unknown stores
    }
  }

  /**
   * Get cleanup recommendations
   */
  static async getCleanupRecommendations() {
    const recommendations = {
      timestamp: new Date().toISOString(),
      indexedDB: await this.getIndexedDBCleanupRecommendations(),
      chromeStorage: await this.getChromeStorageCleanupRecommendations(),
      totalEstimatedSavings: 0
    };

    recommendations.totalEstimatedSavings = 
      recommendations.indexedDB.estimatedSavings + 
      recommendations.chromeStorage.estimatedSavings;

    return recommendations;
  }

  /**
   * IndexedDB cleanup recommendations
   */
  static async getIndexedDBCleanupRecommendations() {
    const recommendations = {
      estimatedSavings: 0,
      actions: []
    };

    try {
      const db = await dbHelper.openDB();

      // Check quota usage
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usageRatio = estimate.usage / estimate.quota;

        if (usageRatio > 0.9) {
          recommendations.actions.push({
            priority: 'critical',
            action: 'cleanup_old_sessions',
            description: 'Remove sessions older than 30 days',
            estimatedSavings: '5-10MB'
          });
        } else if (usageRatio > 0.8) {
          recommendations.actions.push({
            priority: 'high',
            action: 'cleanup_analytics',
            description: 'Remove detailed analytics older than 90 days',
            estimatedSavings: '2-5MB'
          });
        }
      }

      // Check for duplicate attempts
      if (db.objectStoreNames.contains('attempts')) {
        const duplicateCount = await this.estimateDuplicateAttempts(db);
        if (duplicateCount > 0) {
          recommendations.actions.push({
            priority: 'medium',
            action: 'cleanup_duplicates',
            description: `Remove ${duplicateCount} duplicate attempts`,
            estimatedSavings: `${Math.round(duplicateCount * 0.5)}KB`
          });
        }
      }

    } catch (error) {
      console.warn('Failed to get IndexedDB recommendations:', error);
    }

    return recommendations;
  }

  /**
   * Chrome Storage cleanup recommendations
   */
  static async getChromeStorageCleanupRecommendations() {
    const recommendations = {
      estimatedSavings: 0,
      actions: []
    };

    try {
      const allData = await ChromeAPIErrorHandler.storageGetWithRetry(null);
      const totalSize = JSON.stringify(allData).length;
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (totalSize > maxSize * 0.9) {
        recommendations.actions.push({
          priority: 'critical',
          action: 'cleanup_temp_data',
          description: 'Remove temporary cached data',
          estimatedSavings: '1-2MB'
        });
      }

      // Check for old error reports
      const errorKeys = Object.keys(allData).filter(key => key.includes('error'));
      if (errorKeys.length > 10) {
        recommendations.actions.push({
          priority: 'medium',
          action: 'cleanup_errors',
          description: `Remove ${errorKeys.length} old error reports`,
          estimatedSavings: `${Math.round(errorKeys.length * 2)}KB`
        });
      }

    } catch (error) {
      console.warn('Failed to get Chrome Storage recommendations:', error);
    }

    return recommendations;
  }

  /**
   * Estimate duplicate attempts
   */
  static async estimateDuplicateAttempts(db) {
    try {
      const transaction = db.transaction(['attempts'], 'readonly');
      const store = transaction.objectStore('attempts');

      const allAttempts = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const seen = new Set();
      let duplicates = 0;

      allAttempts.forEach(attempt => {
        const key = `${attempt.problemId}_${attempt.sessionId}`;
        if (seen.has(key)) {
          duplicates++;
        } else {
          seen.add(key);
        }
      });

      return duplicates;
    } catch (error) {
      console.warn('Failed to estimate duplicates:', error);
      return 0;
    }
  }

  /**
   * Manual cleanup with user confirmation
   */
  static async performManualCleanup(actions, confirmCallback = null) {
    const results = {
      timestamp: new Date().toISOString(),
      completed: [],
      failed: [],
      totalFreed: 0
    };

    for (const action of actions) {
      try {
        // Ask for user confirmation if callback provided
        if (confirmCallback) {
          const confirmed = await confirmCallback(action);
          if (!confirmed) continue;
        }

        let result;
        switch (action.action) {
          case 'cleanup_old_sessions':
            result = await this.cleanupIndexedDB(0.2, this.CLEANUP_STRATEGY.MODERATE);
            break;
          case 'cleanup_duplicates':
            const db = await dbHelper.openDB();
            const duplicateResults = { freedBytes: 0 };
            await this.cleanupDuplicateAttempts(db, duplicateResults);
            result = { freedBytes: duplicateResults.freedBytes };
            break;
          case 'cleanup_temp_data':
            result = await this.cleanupChromeStorage(0.2);
            break;
          default:
            throw new Error(`Unknown action: ${action.action}`);
        }

        results.completed.push({
          action: action.action,
          freedBytes: result.freedBytes || 0
        });
        results.totalFreed += result.freedBytes || 0;

      } catch (error) {
        console.error(`Manual cleanup action ${action.action} failed:`, error);
        results.failed.push({
          action: action.action,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Emergency cleanup when quota exceeded
   */
  static async emergencyCleanup() {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚨 Performing emergency storage cleanup');
    }
    
    try {
      // Aggressive cleanup to free maximum space quickly
      const results = await this.performAutomaticCleanup(0.3); // Target 30% free space
      
      // Report emergency cleanup
      await ErrorReportService.storeErrorReport({
        errorId: `emergency_cleanup_${Date.now()}`,
        message: 'Emergency storage cleanup performed',
        stack: JSON.stringify(results, null, 2),
        section: 'Storage Management',
        errorType: 'emergency_cleanup',
        severity: 'medium',
        userContext: { totalFreed: results.totalFreedBytes }
      });

      return results;
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      throw error;
    }
  }
}

export default StorageCleanupManager;