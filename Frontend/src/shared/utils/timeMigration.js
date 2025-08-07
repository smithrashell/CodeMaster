/**
 * Time Migration Utilities for CodeMaster
 * 
 * Handles migration of time data from mixed units to standardized seconds format
 * and provides validation utilities for time-related data
 */

import { dbHelper } from "../db/index.js";
import AccurateTimer from "./AccurateTimer.js";

/**
 * Detects if TimeSpent values are likely in minutes vs seconds
 * @param {Array} attempts - Array of attempt records
 * @returns {Object} Analysis of time units
 */
export function analyzeTimeUnits(attempts) {
  const timeValues = attempts
    .map(a => Number(a.TimeSpent) || 0)
    .filter(t => t > 0);

  if (timeValues.length === 0) {
    return { unit: 'unknown', confidence: 0, avgTime: 0, count: 0 };
  }

  const avgTime = timeValues.reduce((sum, t) => sum + t, 0) / timeValues.length;
  const maxTime = Math.max(...timeValues);
  const minTime = Math.min(...timeValues);

  // Heuristics to detect unit:
  // - If average time > 3600, likely seconds (>1 hour average)
  // - If max time < 180, likely minutes (<3 hours)
  // - If average time < 60 and max < 300, likely minutes
  
  let unit = 'unknown';
  let confidence = 0;

  if (avgTime > 3600 && maxTime > 1800) {
    unit = 'seconds';
    confidence = 0.9;
  } else if (avgTime < 60 && maxTime < 300) {
    unit = 'minutes';
    confidence = 0.8;
  } else if (maxTime < 180) {
    unit = 'minutes';
    confidence = 0.7;
  } else if (avgTime > 300) {
    unit = 'seconds';
    confidence = 0.6;
  } else {
    // Ambiguous - make best guess based on typical problem-solving time
    unit = avgTime > 30 ? 'seconds' : 'minutes';
    confidence = 0.4;
  }

  return {
    unit,
    confidence,
    avgTime,
    minTime,
    maxTime,
    count: timeValues.length,
    sampleValues: timeValues.slice(0, 5)
  };
}

/**
 * Validates and normalizes time data to seconds
 * @param {number|string} timeValue - Time value to normalize
 * @param {string} sourceUnit - Source unit ('minutes', 'seconds', or 'auto')
 * @returns {number} Time in seconds
 */
export function normalizeTimeToSeconds(timeValue, sourceUnit = 'auto') {
  const numValue = Number(timeValue) || 0;
  
  if (numValue <= 0) return 0;
  
  switch (sourceUnit) {
    case 'minutes':
      return AccurateTimer.minutesToSeconds(numValue);
    case 'seconds':
      return Math.floor(numValue);
    case 'auto':
      // Auto-detect: if value is very large, assume seconds; if small, assume minutes
      if (numValue >= 900) { // >= 15 minutes, likely seconds
        return Math.floor(numValue);
      } else if (numValue < 4) { // < 4, likely minutes
        return AccurateTimer.minutesToSeconds(numValue);
      } else {
        // Ambiguous range (4-900), make conservative guess
        // Most LeetCode problems take 5-60 minutes, so assume minutes
        return AccurateTimer.minutesToSeconds(numValue);
      }
    default:
      return Math.floor(numValue);
  }
}

/**
 * Migrates time data in attempts store to standardized seconds format
 * @param {boolean} dryRun - If true, only analyze without modifying data
 * @returns {Promise<Object>} Migration results
 */
export async function migrateAttemptsTimeData(dryRun = false) {
  const db = await dbHelper.openDB();
  const transaction = db.transaction(['attempts'], dryRun ? 'readonly' : 'readwrite');
  const store = transaction.objectStore('attempts');
  
  const attempts = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const analysis = analyzeTimeUnits(attempts);
  let migratedCount = 0;
  let errorCount = 0;
  const errors = [];

  console.log('⏰ Time data analysis:', analysis);

  if (!dryRun && analysis.confidence > 0.5) {
    const assumedUnit = analysis.unit;
    
    for (const attempt of attempts) {
      try {
        const originalTime = attempt.TimeSpent;
        const normalizedTime = normalizeTimeToSeconds(originalTime, assumedUnit);
        
        if (normalizedTime !== Number(originalTime)) {
          attempt.TimeSpent = normalizedTime;
          
          // Update in database
          await new Promise((resolve, reject) => {
            const updateRequest = store.put(attempt);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
          });
          
          migratedCount++;
          
          if (migratedCount <= 5) { // Log first 5 migrations
            console.log(`✅ Migrated attempt ${attempt.id}: ${originalTime} → ${normalizedTime} seconds`);
          }
        }
      } catch (error) {
        errorCount++;
        errors.push({ attemptId: attempt.id, error: error.message });
        console.error(`❌ Error migrating attempt ${attempt.id}:`, error);
      }
    }
  }

  return {
    analysis,
    migratedCount,
    errorCount,
    errors,
    dryRun,
    totalRecords: attempts.length
  };
}

/**
 * Validates time consistency across all database stores
 * @returns {Promise<Object>} Validation results
 */
export async function validateTimeConsistency() {
  const db = await dbHelper.openDB();
  const results = {
    attempts: null,
    problems: null,
    sessions: null,
    issues: []
  };

  try {
    // Check attempts store
    const attemptsTransaction = db.transaction(['attempts'], 'readonly');
    const attemptsStore = attemptsTransaction.objectStore('attempts');
    const attempts = await new Promise((resolve, reject) => {
      const request = attemptsStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    results.attempts = analyzeTimeUnits(attempts);

    // Check for obvious issues
    attempts.forEach(attempt => {
      const time = Number(attempt.TimeSpent) || 0;
      if (time > 14400) { // > 4 hours
        results.issues.push({
          type: 'suspicious_long_time',
          record: 'attempt',
          id: attempt.id,
          value: time,
          message: `Attempt time of ${time} seconds (${AccurateTimer.formatTime(time)}) seems unusually long`
        });
      } else if (time > 0 && time < 10) { // < 10 seconds
        results.issues.push({
          type: 'suspicious_short_time',
          record: 'attempt',
          id: attempt.id,
          value: time,
          message: `Attempt time of ${time} seconds seems unusually short`
        });
      }
    });

  } catch (error) {
    results.issues.push({
      type: 'validation_error',
      record: 'attempts',
      message: error.message
    });
  }

  return results;
}

/**
 * Creates a backup of time-sensitive data before migration
 * @returns {Promise<string>} Backup ID
 */
export async function backupTimeData() {
  const db = await dbHelper.openDB();
  const backupId = `time_backup_${Date.now()}`;
  
  const transaction = db.transaction(['attempts', 'backup_storage'], 'readwrite');
  const attemptsStore = transaction.objectStore('attempts');
  const backupStore = transaction.objectStore('backup_storage');
  
  const attempts = await new Promise((resolve, reject) => {
    const request = attemptsStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const backupData = {
    backupId,
    timestamp: new Date().toISOString(),
    type: 'time_data_backup',
    data: {
      attempts: attempts.map(a => ({
        id: a.id,
        TimeSpent: a.TimeSpent,
        ProblemID: a.ProblemID,
        AttemptDate: a.AttemptDate
      }))
    },
    recordCount: attempts.length
  };

  await new Promise((resolve, reject) => {
    const request = backupStore.put(backupData);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  console.log(`✅ Time data backup created: ${backupId} (${attempts.length} records)`);
  return backupId;
}

/**
 * Comprehensive time data migration with safety checks
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} Migration results
 */
export async function performSafeTimeMigration(options = {}) {
  const {
    createBackup = true,
    dryRun = false,
    forceUnit = null // 'minutes' or 'seconds' to override auto-detection
  } = options;

  console.log('🔄 Starting safe time data migration...');
  
  try {
    // Step 1: Validate current data
    const validation = await validateTimeConsistency();
    console.log('📊 Validation results:', validation);

    // Step 2: Create backup if requested
    let backupId = null;
    if (createBackup && !dryRun) {
      backupId = await backupTimeData();
    }

    // Step 3: Perform migration
    const migration = await migrateAttemptsTimeData(dryRun);

    // Step 4: Final validation
    let postValidation = null;
    if (!dryRun) {
      postValidation = await validateTimeConsistency();
    }

    const results = {
      success: true,
      backupId,
      preValidation: validation,
      migration,
      postValidation,
      recommendations: generateRecommendations(validation, migration)
    };

    console.log('✅ Time migration completed successfully');
    return results;

  } catch (error) {
    console.error('❌ Time migration failed:', error);
    return {
      success: false,
      error: error.message,
      recommendations: ['Review error logs', 'Consider manual data cleanup']
    };
  }
}

function generateRecommendations(validation, migration) {
  const recommendations = [];
  
  if (validation.attempts?.confidence < 0.6) {
    recommendations.push('Time unit detection has low confidence - consider manual review');
  }
  
  if (validation.issues.length > 0) {
    recommendations.push(`Found ${validation.issues.length} potential data issues - review suspicious entries`);
  }
  
  if (migration.migratedCount > 0) {
    recommendations.push(`Successfully migrated ${migration.migratedCount} records to seconds format`);
  }
  
  if (migration.errorCount > 0) {
    recommendations.push(`${migration.errorCount} records had migration errors - review error log`);
  }
  
  return recommendations;
}

export default {
  analyzeTimeUnits,
  normalizeTimeToSeconds,
  migrateAttemptsTimeData,
  validateTimeConsistency,
  backupTimeData,
  performSafeTimeMigration
};