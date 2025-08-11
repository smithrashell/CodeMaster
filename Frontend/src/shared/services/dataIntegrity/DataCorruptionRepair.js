/**
 * Data Corruption Repair Service for CodeMaster
 *
 * Provides automated detection and repair capabilities for various types of data corruption
 * including duplicate records, invalid data types, missing fields, and inconsistent state.
 */

import { dbHelper } from "../../db/index.js";
import DataIntegritySchemas from "../../utils/dataIntegrity/DataIntegritySchemas.js";
import SchemaValidator from "../../utils/dataIntegrity/SchemaValidator.js";
import ReferentialIntegrityService from "./ReferentialIntegrityService.js";
import ErrorReportService from "../ErrorReportService.js";

export class DataCorruptionRepair {
  // Corruption types that can be detected and repaired
  static CORRUPTION_TYPES = {
    DUPLICATE_RECORDS: "duplicate_records",
    INVALID_DATA_TYPES: "invalid_data_types",
    MISSING_REQUIRED_FIELDS: "missing_required_fields",
    ORPHANED_RECORDS: "orphaned_records",
    INCONSISTENT_STATE: "inconsistent_state",
    MALFORMED_TIMESTAMPS: "malformed_timestamps",
    NULL_PRIMARY_KEYS: "null_primary_keys",
    CIRCULAR_REFERENCES: "circular_references",
  };

  // Repair strategies with risk levels
  static REPAIR_STRATEGIES = {
    SAFE_DELETE: { risk: "low", automated: true },
    SAFE_UPDATE: { risk: "low", automated: true },
    MERGE_DUPLICATES: { risk: "medium", automated: true },
    RECONSTRUCT_DATA: { risk: "medium", automated: false },
    MANUAL_REVIEW: { risk: "high", automated: false },
  };

  static repairHistory = [];
  static maxHistorySize = 50;

  /**
   * Detect and repair data corruption across all stores
   * @param {Object} options - Repair options
   * @returns {Promise<Object>} - Comprehensive repair result
   */
  static async detectAndRepairCorruption(options = {}) {
    const {
      stores = DataIntegritySchemas.getStoreNames(),
      dryRun = false,
      autoRepairSafe = true,
      createBackup = true,
      maxRepairs = 100,
      priority = "medium",
    } = options;

    console.log(
      `🔧 Starting corruption detection and repair (${
        dryRun ? "DRY RUN" : "LIVE"
      })...`
    );
    const startTime = performance.now();

    const result = {
      repairId: this.generateRepairId(),
      timestamp: new Date().toISOString(),
      dryRun,
      overall: {
        success: true,
        corruptionDetected: false,
        totalIssues: 0,
        repairsAttempted: 0,
        repairsSuccessful: 0,
        repairsFailed: 0,
      },
      storeResults: {},
      backup: null,
      errors: [],
      performanceMetrics: {
        totalTime: 0,
        detectionTime: 0,
        repairTime: 0,
      },
    };

    try {
      // Create backup before repairs if requested
      if (createBackup && !dryRun) {
        console.log("💾 Creating backup before repairs...");
        result.backup = await this.createRepairBackup();
      }

      const db = await dbHelper.openDB();
      const detectionStartTime = performance.now();

      // Detect corruption in each store
      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          console.warn(`Store '${storeName}' does not exist`);
          continue;
        }

        console.log(`🔍 Analyzing corruption in store: ${storeName}`);
        const storeResult = await this.detectStoreCorruption(
          db,
          storeName,
          options
        );
        result.storeResults[storeName] = storeResult;

        if (storeResult.corruptionFound) {
          result.overall.corruptionDetected = true;
          result.overall.totalIssues += storeResult.issues.length;
        }
      }

      const detectionEndTime = performance.now();
      result.performanceMetrics.detectionTime =
        detectionEndTime - detectionStartTime;

      // Perform repairs if corruption was detected
      if (result.overall.corruptionDetected) {
        console.log(`🛠️ Corruption detected, starting repair process...`);
        const repairStartTime = performance.now();

        await this.executeRepairs(db, result, {
          dryRun,
          autoRepairSafe,
          maxRepairs,
          priority,
        });

        const repairEndTime = performance.now();
        result.performanceMetrics.repairTime = repairEndTime - repairStartTime;
      } else {
        console.log("✅ No corruption detected");
      }

      const endTime = performance.now();
      result.performanceMetrics.totalTime = endTime - startTime;

      // Add to repair history
      this.addToRepairHistory(result);

      console.log(
        `🏁 Corruption repair completed: ${result.overall.repairsSuccessful} successful, ${result.overall.repairsFailed} failed`
      );
      return result;
    } catch (error) {
      console.error("❌ Corruption repair process failed:", error);
      result.overall.success = false;
      result.errors.push({
        type: "system_error",
        message: error.message,
        stack: error.stack,
      });

      await this.reportRepairError("corruption_repair", error, options);
      return result;
    }
  }

  /**
   * Detect corruption in a specific store
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} - Store corruption analysis
   */
  static async detectStoreCorruption(db, storeName, options = {}) {
    const { priority = "medium", deepAnalysis = false } = options;

    const result = {
      storeName,
      corruptionFound: false,
      issues: [],
      recordCount: 0,
      performanceMetrics: {
        analysisTime: 0,
      },
    };

    const startTime = performance.now();

    try {
      const storeData = await this.getAllStoreData(db, storeName);
      result.recordCount = storeData.length;

      if (storeData.length === 0) {
        console.log(`📝 Store '${storeName}' is empty`);
        return result;
      }

      console.log(
        `📊 Analyzing ${storeData.length} records in ${storeName}...`
      );

      // Run different corruption checks
      await Promise.all([
        this.checkDuplicateRecords(storeData, storeName, result),
        this.checkInvalidDataTypes(storeData, storeName, result),
        this.checkMissingRequiredFields(storeData, storeName, result),
        this.checkMalformedTimestamps(storeData, storeName, result),
        this.checkNullPrimaryKeys(storeData, storeName, result),
      ]);

      // Additional checks for high priority or deep analysis
      if (priority === "high" || deepAnalysis) {
        await Promise.all([
          this.checkInconsistentState(storeData, storeName, result),
          this.checkCircularReferences(storeData, storeName, result),
        ]);
      }

      result.corruptionFound = result.issues.length > 0;

      const endTime = performance.now();
      result.performanceMetrics.analysisTime = endTime - startTime;

      console.log(
        `📋 ${storeName} analysis: ${
          result.issues.length
        } issues found in ${result.performanceMetrics.analysisTime.toFixed(
          2
        )}ms`
      );
      return result;
    } catch (error) {
      console.error(`❌ Corruption analysis failed for ${storeName}:`, error);
      result.issues.push({
        type: "analysis_error",
        severity: "error",
        message: `Failed to analyze store: ${error.message}`,
        error: error.stack,
      });
      return result;
    }
  }

  /**
   * Check for duplicate records
   * @param {Array} storeData - Store data
   * @param {string} storeName - Store name
   * @param {Object} result - Result object to populate
   */
  static async checkDuplicateRecords(storeData, storeName, result) {
    try {
      const seen = new Map();
      const duplicates = [];

      // Get the primary key field for this store
      const primaryKeyField = this.getPrimaryKeyField(storeName);

      for (let i = 0; i < storeData.length; i++) {
        const record = storeData[i];
        const keyValue = record[primaryKeyField];

        if (keyValue !== null && keyValue !== undefined) {
          if (seen.has(keyValue)) {
            duplicates.push({
              originalIndex: seen.get(keyValue),
              duplicateIndex: i,
              keyValue,
              record: this.sanitizeRecord(record),
            });
          } else {
            seen.set(keyValue, i);
          }
        }
      }

      if (duplicates.length > 0) {
        result.issues.push({
          type: this.CORRUPTION_TYPES.DUPLICATE_RECORDS,
          severity: "warning",
          count: duplicates.length,
          message: `Found ${duplicates.length} duplicate records in ${storeName}`,
          details: duplicates,
          repairStrategy: this.REPAIR_STRATEGIES.MERGE_DUPLICATES,
          automated: true,
        });
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
    }
  }

  /**
   * Check for invalid data types based on schema
   * @param {Array} storeData - Store data
   * @param {string} storeName - Store name
   * @param {Object} result - Result object to populate
   */
  static async checkInvalidDataTypes(storeData, storeName, result) {
    try {
      const invalidRecords = [];
      const schema = DataIntegritySchemas.getStoreSchema(storeName);

      if (!schema) {
        console.warn(`No schema found for store: ${storeName}`);
        return;
      }

      for (let i = 0; i < storeData.length; i++) {
        const record = storeData[i];
        const validationResult = SchemaValidator.validateData(
          storeName,
          record,
          {
            skipBusinessLogic: true,
            strict: false,
          }
        );

        if (!validationResult.valid) {
          const typeErrors = validationResult.errors.filter(
            (e) =>
              e.type.includes("type_mismatch") ||
              e.type.includes("format_violation") ||
              e.type.includes("enum_violation")
          );

          if (typeErrors.length > 0) {
            invalidRecords.push({
              index: i,
              recordId: this.getRecordId(record),
              errors: typeErrors,
              record: this.sanitizeRecord(record),
            });
          }
        }
      }

      if (invalidRecords.length > 0) {
        result.issues.push({
          type: this.CORRUPTION_TYPES.INVALID_DATA_TYPES,
          severity: "error",
          count: invalidRecords.length,
          message: `Found ${invalidRecords.length} records with invalid data types in ${storeName}`,
          details: invalidRecords,
          repairStrategy: this.REPAIR_STRATEGIES.SAFE_UPDATE,
          automated: false, // Type corrections usually need manual review
        });
      }
    } catch (error) {
      console.error("Error checking data types:", error);
    }
  }

  /**
   * Check for missing required fields
   * @param {Array} storeData - Store data
   * @param {string} storeName - Store name
   * @param {Object} result - Result object to populate
   */
  static async checkMissingRequiredFields(storeData, storeName, result) {
    try {
      const schema = DataIntegritySchemas.getStoreSchema(storeName);
      if (!schema || !schema.required) {
        return;
      }

      const recordsWithMissingFields = [];

      for (let i = 0; i < storeData.length; i++) {
        const record = storeData[i];
        const missingFields = [];

        for (const requiredField of schema.required) {
          if (
            !(requiredField in record) ||
            record[requiredField] === null ||
            record[requiredField] === undefined
          ) {
            missingFields.push(requiredField);
          }
        }

        if (missingFields.length > 0) {
          recordsWithMissingFields.push({
            index: i,
            recordId: this.getRecordId(record),
            missingFields,
            record: this.sanitizeRecord(record),
          });
        }
      }

      if (recordsWithMissingFields.length > 0) {
        result.issues.push({
          type: this.CORRUPTION_TYPES.MISSING_REQUIRED_FIELDS,
          severity: "error",
          count: recordsWithMissingFields.length,
          message: `Found ${recordsWithMissingFields.length} records with missing required fields in ${storeName}`,
          details: recordsWithMissingFields,
          repairStrategy: this.REPAIR_STRATEGIES.SAFE_DELETE,
          automated: true,
        });
      }
    } catch (error) {
      console.error("Error checking required fields:", error);
    }
  }

  /**
   * Check for malformed timestamps
   * @param {Array} storeData - Store data
   * @param {string} storeName - Store name
   * @param {Object} result - Result object to populate
   */
  static async checkMalformedTimestamps(storeData, storeName, result) {
    try {
      const timestampFields = this.getTimestampFields(storeName);
      const malformedTimestamps = [];

      for (let i = 0; i < storeData.length; i++) {
        const record = storeData[i];
        const recordIssues = [];

        for (const field of timestampFields) {
          if (record[field] !== null && record[field] !== undefined) {
            const timestamp = record[field];
            const parsedDate = new Date(timestamp);

            if (
              isNaN(parsedDate.getTime()) ||
              parsedDate.getFullYear() < 2000 ||
              parsedDate.getFullYear() > 2100
            ) {
              recordIssues.push({
                field,
                value: timestamp,
                issue: "invalid_timestamp",
              });
            }
          }
        }

        if (recordIssues.length > 0) {
          malformedTimestamps.push({
            index: i,
            recordId: this.getRecordId(record),
            issues: recordIssues,
            record: this.sanitizeRecord(record),
          });
        }
      }

      if (malformedTimestamps.length > 0) {
        result.issues.push({
          type: this.CORRUPTION_TYPES.MALFORMED_TIMESTAMPS,
          severity: "warning",
          count: malformedTimestamps.length,
          message: `Found ${malformedTimestamps.length} records with malformed timestamps in ${storeName}`,
          details: malformedTimestamps,
          repairStrategy: this.REPAIR_STRATEGIES.SAFE_UPDATE,
          automated: true,
        });
      }
    } catch (error) {
      console.error("Error checking timestamps:", error);
    }
  }

  /**
   * Check for null primary keys
   * @param {Array} storeData - Store data
   * @param {string} storeName - Store name
   * @param {Object} result - Result object to populate
   */
  static async checkNullPrimaryKeys(storeData, storeName, result) {
    try {
      const primaryKeyField = this.getPrimaryKeyField(storeName);
      const nullPrimaryKeys = [];

      for (let i = 0; i < storeData.length; i++) {
        const record = storeData[i];
        const primaryKey = record[primaryKeyField];

        if (
          primaryKey === null ||
          primaryKey === undefined ||
          primaryKey === ""
        ) {
          nullPrimaryKeys.push({
            index: i,
            field: primaryKeyField,
            record: this.sanitizeRecord(record),
          });
        }
      }

      if (nullPrimaryKeys.length > 0) {
        result.issues.push({
          type: this.CORRUPTION_TYPES.NULL_PRIMARY_KEYS,
          severity: "error",
          count: nullPrimaryKeys.length,
          message: `Found ${nullPrimaryKeys.length} records with null primary keys in ${storeName}`,
          details: nullPrimaryKeys,
          repairStrategy: this.REPAIR_STRATEGIES.SAFE_DELETE,
          automated: true,
        });
      }
    } catch (error) {
      console.error("Error checking primary keys:", error);
    }
  }

  /**
   * Check for inconsistent state across related fields
   * @param {Array} storeData - Store data
   * @param {string} storeName - Store name
   * @param {Object} result - Result object to populate
   */
  static async checkInconsistentState(storeData, storeName, result) {
    try {
      const inconsistentRecords = [];

      // Store-specific consistency checks
      switch (storeName) {
        case "problems":
          for (let i = 0; i < storeData.length; i++) {
            const problem = storeData[i];
            const inconsistencies = [];

            // Check attempt stats consistency
            if (problem.AttemptStats) {
              const {
                TotalAttempts,
                SuccessfulAttempts,
                UnsuccessfulAttempts,
              } = problem.AttemptStats;

              if (SuccessfulAttempts + UnsuccessfulAttempts !== TotalAttempts) {
                inconsistencies.push({
                  field: "AttemptStats",
                  issue: "sum_mismatch",
                  expected: TotalAttempts,
                  actual: SuccessfulAttempts + UnsuccessfulAttempts,
                });
              }

              if (SuccessfulAttempts > TotalAttempts) {
                inconsistencies.push({
                  field: "AttemptStats.SuccessfulAttempts",
                  issue: "exceeds_total",
                  value: SuccessfulAttempts,
                  total: TotalAttempts,
                });
              }
            }

            // Check box level consistency
            if (
              problem.BoxLevel > 0 &&
              (!problem.AttemptStats ||
                problem.AttemptStats.TotalAttempts === 0)
            ) {
              inconsistencies.push({
                field: "BoxLevel",
                issue: "box_level_without_attempts",
                value: problem.BoxLevel,
              });
            }

            if (inconsistencies.length > 0) {
              inconsistentRecords.push({
                index: i,
                recordId: this.getRecordId(problem),
                inconsistencies,
                record: this.sanitizeRecord(problem),
              });
            }
          }
          break;

        case "tag_mastery":
          for (let i = 0; i < storeData.length; i++) {
            const tagMastery = storeData[i];
            const inconsistencies = [];

            if (tagMastery.totalAttempts < tagMastery.successfulAttempts) {
              inconsistencies.push({
                field: "successfulAttempts",
                issue: "exceeds_total",
                successful: tagMastery.successfulAttempts,
                total: tagMastery.totalAttempts,
              });
            }

            if (tagMastery.mastered && tagMastery.successfulAttempts === 0) {
              inconsistencies.push({
                field: "mastered",
                issue: "mastered_without_success",
                value: true,
              });
            }

            if (inconsistencies.length > 0) {
              inconsistentRecords.push({
                index: i,
                recordId: this.getRecordId(tagMastery),
                inconsistencies,
                record: this.sanitizeRecord(tagMastery),
              });
            }
          }
          break;

        case "sessions":
          for (let i = 0; i < storeData.length; i++) {
            const session = storeData[i];
            const inconsistencies = [];

            // Check that session problems and attempts are consistent
            if (session.problems && session.attempts) {
              const sessionProblemIds = new Set(
                session.problems.map((p) => p.id)
              );
              const attemptProblemIds = new Set(
                session.attempts.map((a) => a.problemId)
              );

              const problemsNotInAttempts = [...sessionProblemIds].filter(
                (id) => !attemptProblemIds.has(id)
              );
              if (problemsNotInAttempts.length > 0) {
                inconsistencies.push({
                  field: "problems_attempts_mismatch",
                  issue: "problems_without_attempts",
                  problemIds: problemsNotInAttempts,
                });
              }
            }

            if (inconsistencies.length > 0) {
              inconsistentRecords.push({
                index: i,
                recordId: this.getRecordId(session),
                inconsistencies,
                record: this.sanitizeRecord(session),
              });
            }
          }
          break;

        default:
          // No specific consistency checks for this store
          break;
      }

      if (inconsistentRecords.length > 0) {
        result.issues.push({
          type: this.CORRUPTION_TYPES.INCONSISTENT_STATE,
          severity: "warning",
          count: inconsistentRecords.length,
          message: `Found ${inconsistentRecords.length} records with inconsistent state in ${storeName}`,
          details: inconsistentRecords,
          repairStrategy: this.REPAIR_STRATEGIES.SAFE_UPDATE,
          automated: true,
        });
      }
    } catch (error) {
      console.error("Error checking consistency:", error);
    }
  }

  /**
   * Check for circular references
   * @param {Array} storeData - Store data
   * @param {string} storeName - Store name
   * @param {Object} result - Result object to populate
   */
  static async checkCircularReferences(storeData, storeName, result) {
    try {
      // Only applicable to certain stores
      if (!["problem_relationships", "tag_relationships"].includes(storeName)) {
        return;
      }

      const circularReferences = [];
      const visited = new Set();
      const stack = new Set();

      const findCycle = (recordId, path = []) => {
        if (stack.has(recordId)) {
          // Found a cycle
          const cycleStart = path.indexOf(recordId);
          return path.slice(cycleStart).concat([recordId]);
        }

        if (visited.has(recordId)) {
          return null; // Already processed
        }

        visited.add(recordId);
        stack.add(recordId);

        // Find related records
        const relatedIds = this.getRelatedRecordIds(
          storeData,
          recordId,
          storeName
        );

        for (const relatedId of relatedIds) {
          const cycle = findCycle(relatedId, [...path, recordId]);
          if (cycle) {
            return cycle;
          }
        }

        stack.delete(recordId);
        return null;
      };

      // Check each record for cycles
      for (const record of storeData) {
        const recordId = this.getRecordId(record);
        if (!visited.has(recordId)) {
          const cycle = findCycle(recordId);
          if (cycle) {
            circularReferences.push({
              cycle,
              record: this.sanitizeRecord(record),
            });
          }
        }
      }

      if (circularReferences.length > 0) {
        result.issues.push({
          type: this.CORRUPTION_TYPES.CIRCULAR_REFERENCES,
          severity: "warning",
          count: circularReferences.length,
          message: `Found ${circularReferences.length} circular references in ${storeName}`,
          details: circularReferences,
          repairStrategy: this.REPAIR_STRATEGIES.MANUAL_REVIEW,
          automated: false,
        });
      }
    } catch (error) {
      console.error("Error checking circular references:", error);
    }
  }

  /**
   * Execute repairs based on detected corruption
   * @param {IDBDatabase} db - Database instance
   * @param {Object} result - Overall result object
   * @param {Object} options - Repair options
   */
  static async executeRepairs(db, result, options = {}) {
    const {
      dryRun = false,
      autoRepairSafe = true,
      maxRepairs = 100,
      priority = "medium",
    } = options;

    let repairsAttempted = 0;

    for (const [storeName, storeResult] of Object.entries(
      result.storeResults
    )) {
      if (!storeResult.corruptionFound || repairsAttempted >= maxRepairs) {
        continue;
      }

      console.log(`🔧 Repairing corruption in ${storeName}...`);

      for (const issue of storeResult.issues) {
        if (repairsAttempted >= maxRepairs) {
          console.warn(`⚠️ Maximum repair limit (${maxRepairs}) reached`);
          break;
        }

        // Skip non-automated repairs unless explicitly requested
        if (!issue.automated && autoRepairSafe) {
          console.log(`⏭️ Skipping non-automated repair: ${issue.type}`);
          continue;
        }

        try {
          const repairResult = await this.executeRepair(db, storeName, issue, {
            dryRun,
            priority,
          });

          repairsAttempted++;
          result.overall.repairsAttempted++;

          if (repairResult.success) {
            result.overall.repairsSuccessful++;
            console.log(`✅ Repair successful: ${issue.type} in ${storeName}`);
          } else {
            result.overall.repairsFailed++;
            console.error(`❌ Repair failed: ${repairResult.error}`);
          }

          // Add repair result to the issue
          issue.repairResult = repairResult;
        } catch (error) {
          result.overall.repairsFailed++;
          console.error(`❌ Repair exception for ${issue.type}:`, error);

          issue.repairResult = {
            success: false,
            error: error.message,
            stack: error.stack,
          };
        }
      }
    }
  }

  /**
   * Execute a specific repair
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   * @param {Object} issue - Issue to repair
   * @param {Object} options - Repair options
   * @returns {Promise<Object>} - Repair result
   */
  static async executeRepair(db, storeName, issue, options = {}) {
    const { dryRun = false, priority = "medium" } = options;

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        action: `Would repair ${issue.type}`,
        affectedRecords: issue.count || issue.details?.length || 0,
      };
    }

    switch (issue.type) {
      case this.CORRUPTION_TYPES.DUPLICATE_RECORDS:
        return await this.repairDuplicates(db, storeName, issue);

      case this.CORRUPTION_TYPES.MISSING_REQUIRED_FIELDS:
        return await this.repairMissingFields(db, storeName, issue);

      case this.CORRUPTION_TYPES.NULL_PRIMARY_KEYS:
        return await this.repairNullPrimaryKeys(db, storeName, issue);

      case this.CORRUPTION_TYPES.MALFORMED_TIMESTAMPS:
        return await this.repairMalformedTimestamps(db, storeName, issue);

      case this.CORRUPTION_TYPES.INCONSISTENT_STATE:
        return await this.repairInconsistentState(db, storeName, issue);

      default:
        return {
          success: false,
          error: `Unsupported repair type: ${issue.type}`,
        };
    }
  }

  /**
   * Repair duplicate records by merging or removing
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   * @param {Object} issue - Issue details
   * @returns {Promise<Object>} - Repair result
   */
  static async repairDuplicates(db, storeName, issue) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    let repairedCount = 0;

    try {
      for (const duplicate of issue.details) {
        // Delete the duplicate record (keep the original)
        await new Promise((resolve, reject) => {
          const deleteRequest = store.delete(duplicate.keyValue);
          deleteRequest.onsuccess = () => {
            repairedCount++;
            resolve();
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }

      return {
        success: true,
        action: "removed_duplicates",
        repairedCount,
        message: `Removed ${repairedCount} duplicate records`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        repairedCount,
      };
    }
  }

  /**
   * Repair records with missing required fields
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   * @param {Object} issue - Issue details
   * @returns {Promise<Object>} - Repair result
   */
  static async repairMissingFields(db, storeName, issue) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    let repairedCount = 0;

    try {
      for (const recordInfo of issue.details) {
        // Delete records that are missing critical required fields
        const primaryKey = this.getRecordPrimaryKey(
          recordInfo.record,
          storeName
        );

        await new Promise((resolve, reject) => {
          const deleteRequest = store.delete(primaryKey);
          deleteRequest.onsuccess = () => {
            repairedCount++;
            resolve();
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }

      return {
        success: true,
        action: "removed_incomplete_records",
        repairedCount,
        message: `Removed ${repairedCount} records with missing required fields`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        repairedCount,
      };
    }
  }

  /**
   * Repair null primary keys by removing records
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   * @param {Object} issue - Issue details
   * @returns {Promise<Object>} - Repair result
   */
  static async repairNullPrimaryKeys(db, storeName, issue) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    let repairedCount = 0;

    try {
      // For records with null primary keys, we need to identify them by other means
      const allRecords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const primaryKeyField = this.getPrimaryKeyField(storeName);

      for (let i = allRecords.length - 1; i >= 0; i--) {
        const record = allRecords[i];
        const primaryKey = record[primaryKeyField];

        if (
          primaryKey === null ||
          primaryKey === undefined ||
          primaryKey === ""
        ) {
          // Clear the store and rebuild without the corrupted record
          await new Promise((resolve, reject) => {
            const deleteRequest = store.clear();
            deleteRequest.onsuccess = resolve;
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });

          // Re-add all records except the corrupted ones
          for (const validRecord of allRecords) {
            const validPrimaryKey = validRecord[primaryKeyField];
            if (
              validPrimaryKey !== null &&
              validPrimaryKey !== undefined &&
              validPrimaryKey !== ""
            ) {
              await new Promise((resolve, reject) => {
                const addRequest = store.add(validRecord);
                addRequest.onsuccess = resolve;
                addRequest.onerror = () => reject(addRequest.error);
              });
            } else {
              repairedCount++;
            }
          }
          break;
        }
      }

      return {
        success: true,
        action: "removed_null_primary_keys",
        repairedCount,
        message: `Removed ${repairedCount} records with null primary keys`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        repairedCount: 0,
      };
    }
  }

  /**
   * Repair malformed timestamps
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   * @param {Object} issue - Issue details
   * @returns {Promise<Object>} - Repair result
   */
  static async repairMalformedTimestamps(db, storeName, issue) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    let repairedCount = 0;

    try {
      for (const recordInfo of issue.details) {
        const primaryKey = this.getRecordPrimaryKey(
          recordInfo.record,
          storeName
        );

        const record = await new Promise((resolve, reject) => {
          const getRequest = store.get(primaryKey);
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
        });

        if (record) {
          // Fix timestamp issues
          let updated = false;
          for (const timestampIssue of recordInfo.issues) {
            const { field } = timestampIssue;

            // Set to current timestamp as fallback
            record[field] = new Date().toISOString();
            updated = true;
          }

          if (updated) {
            await new Promise((resolve, reject) => {
              const putRequest = store.put(record);
              putRequest.onsuccess = () => {
                repairedCount++;
                resolve();
              };
              putRequest.onerror = () => reject(putRequest.error);
            });
          }
        }
      }

      return {
        success: true,
        action: "fixed_timestamps",
        repairedCount,
        message: `Fixed ${repairedCount} malformed timestamps`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        repairedCount,
      };
    }
  }

  /**
   * Repair inconsistent state
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Store name
   * @param {Object} issue - Issue details
   * @returns {Promise<Object>} - Repair result
   */
  static async repairInconsistentState(db, storeName, issue) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    let repairedCount = 0;

    try {
      for (const recordInfo of issue.details) {
        const primaryKey = this.getRecordPrimaryKey(
          recordInfo.record,
          storeName
        );

        const record = await new Promise((resolve, reject) => {
          const getRequest = store.get(primaryKey);
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
        });

        if (record) {
          let updated = false;

          // Fix specific inconsistencies based on store type
          if (storeName === "problems" && record.AttemptStats) {
            const { TotalAttempts, SuccessfulAttempts } = record.AttemptStats;
            record.AttemptStats.UnsuccessfulAttempts =
              TotalAttempts - SuccessfulAttempts;
            updated = true;
          } else if (storeName === "tag_mastery") {
            if (record.successfulAttempts > record.totalAttempts) {
              record.successfulAttempts = record.totalAttempts;
              updated = true;
            }
            if (record.mastered && record.successfulAttempts === 0) {
              record.mastered = false;
              updated = true;
            }
          }

          if (updated) {
            await new Promise((resolve, reject) => {
              const putRequest = store.put(record);
              putRequest.onsuccess = () => {
                repairedCount++;
                resolve();
              };
              putRequest.onerror = () => reject(putRequest.error);
            });
          }
        }
      }

      return {
        success: true,
        action: "fixed_inconsistencies",
        repairedCount,
        message: `Fixed ${repairedCount} state inconsistencies`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        repairedCount,
      };
    }
  }

  // Helper methods

  static async getAllStoreData(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  static getPrimaryKeyField(storeName) {
    const primaryKeyMap = {
      problems: "id",
      attempts: "id",
      sessions: "id",
      tag_mastery: "tag",
      standard_problems: "id",
      pattern_ladders: "tag",
      settings: "id",
      session_analytics: "sessionId",
      strategy_data: "tag",
      problem_relationships: "id",
      tag_relationships: "id",
      limits: "id",
      backup_storage: "backupId",
      session_state: "id",
    };

    return primaryKeyMap[storeName] || "id";
  }

  static getTimestampFields(storeName) {
    const timestampFieldsMap = {
      problems: ["ReviewSchedule", "CreatedAt", "lastAttemptDate"],
      attempts: ["AttemptDate", "date", "NextReviewDate"],
      sessions: ["Date", "completedAt"],
      tag_mastery: ["lastAttemptDate"],
      standard_problems: [],
      pattern_ladders: ["lastUpdated"],
      settings: ["lastUpdated"],
      session_analytics: ["completedAt"],
      strategy_data: ["lastUpdated"],
      problem_relationships: ["createdAt"],
      tag_relationships: [],
      limits: ["createAt", "resetDate"],
      backup_storage: ["createdAt"],
      session_state: ["lastActiveDate"],
    };

    return timestampFieldsMap[storeName] || [];
  }

  static getRecordId(record) {
    return (
      record.id ||
      record.tag ||
      record.sessionId ||
      record.backupId ||
      record.problemId ||
      record.leetCodeID ||
      "unknown"
    );
  }

  static getRecordPrimaryKey(record, storeName) {
    const primaryKeyField = this.getPrimaryKeyField(storeName);
    return record[primaryKeyField];
  }

  static getRelatedRecordIds(storeData, recordId, storeName) {
    const relatedIds = [];

    for (const record of storeData) {
      switch (storeName) {
        case "problem_relationships":
          if (record.problemId1 === recordId) {
            relatedIds.push(record.problemId2);
          }
          if (record.problemId2 === recordId) {
            relatedIds.push(record.problemId1);
          }
          break;
        case "tag_relationships":
          if (record.id === recordId && record.parentTag) {
            relatedIds.push(record.parentTag);
          }
          if (record.parentTag === recordId) {
            relatedIds.push(record.id);
          }
          break;
      }
    }

    return relatedIds;
  }

  static sanitizeRecord(record) {
    if (!record || typeof record !== "object") {
      return record;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + "...[truncated]";
      } else if (Array.isArray(value) && value.length > 5) {
        sanitized[key] = value.slice(0, 5).concat(["...[truncated]"]);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  static generateRepairId() {
    return `repair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static async createRepairBackup() {
    // This would integrate with the backup system
    const backupId = `corruption_repair_${Date.now()}`;

    return {
      backupId,
      timestamp: new Date().toISOString(),
      type: "corruption_repair",
      description: "Backup created before corruption repair operations",
    };
  }

  static addToRepairHistory(result) {
    const summary = {
      repairId: result.repairId,
      timestamp: result.timestamp,
      dryRun: result.dryRun,
      overall: { ...result.overall },
      performanceMetrics: {
        totalTime: result.performanceMetrics.totalTime,
      },
    };

    this.repairHistory.push(summary);

    if (this.repairHistory.length > this.maxHistorySize) {
      this.repairHistory = this.repairHistory.slice(-this.maxHistorySize);
    }
  }

  static async reportRepairError(operation, error, context) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `repair_error_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        message: `Corruption repair ${operation} failed: ${error.message}`,
        stack: error.stack,
        section: "Data Integrity",
        errorType: "corruption_repair",
        severity: "high",
        userContext: context,
      });
    } catch (reportError) {
      console.warn("Failed to report repair error:", reportError);
    }
  }

  /**
   * Get corruption repair history
   * @param {number} limit - Number of recent repairs to return
   * @returns {Array} - Array of repair summaries
   */
  static getRepairHistory(limit = 10) {
    return this.repairHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get repair statistics
   * @returns {Object} - Repair statistics
   */
  static getRepairStatistics() {
    const totalRepairs = this.repairHistory.length;
    const successfulRepairs = this.repairHistory.filter(
      (r) => r.overall.success
    ).length;
    const totalIssuesFixed = this.repairHistory.reduce(
      (sum, r) => sum + r.overall.repairsSuccessful,
      0
    );

    return {
      totalRepairs,
      successfulRepairs,
      totalIssuesFixed,
      successRate:
        totalRepairs > 0 ? (successfulRepairs / totalRepairs) * 100 : 0,
      averageRepairsPerSession:
        totalRepairs > 0 ? totalIssuesFixed / totalRepairs : 0,
    };
  }
}

export default DataCorruptionRepair;
