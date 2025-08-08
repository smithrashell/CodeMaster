/**
 * Referential Integrity Service for CodeMaster
 * 
 * Enforces foreign key constraints and manages relationships between IndexedDB stores
 * to maintain data consistency across the application.
 */

import { dbHelper } from '../../db/index.js';
import DataIntegritySchemas from '../../utils/dataIntegrity/DataIntegritySchemas.js';
import ErrorReportService from '../ErrorReportService.js';

export class ReferentialIntegrityService {
  // Constraint violation types
  static VIOLATION_TYPES = {
    ORPHANED_RECORD: 'orphaned_record',
    MISSING_REFERENCE: 'missing_reference',
    CIRCULAR_REFERENCE: 'circular_reference',
    INVALID_REFERENCE: 'invalid_reference',
    CONSTRAINT_VIOLATION: 'constraint_violation'
  };

  // Repair strategies
  static REPAIR_STRATEGIES = {
    DELETE_ORPHAN: 'delete_orphan',
    CREATE_REFERENCE: 'create_reference',
    SET_NULL: 'set_null',
    CASCADE_DELETE: 'cascade_delete',
    MANUAL_REVIEW: 'manual_review'
  };

  static integrityCache = new Map();
  static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Check referential integrity for all stores
   * @param {Object} options - Check options
   * @returns {Promise<Object>} - Comprehensive integrity report
   */
  static async checkAllReferentialIntegrity(options = {}) {
    const {
      stores = DataIntegritySchemas.getStoreNames(),
      includeOrphans = true,
      includeMissing = true,
      deepCheck = false,
      useCache = true
    } = options;

    console.log('🔍 Starting comprehensive referential integrity check...');
    const startTime = performance.now();

    const report = {
      timestamp: new Date().toISOString(),
      overall: {
        valid: true,
        violationCount: 0,
        storesChecked: 0,
        constraintsChecked: 0
      },
      storeResults: {},
      violations: [],
      repairSuggestions: [],
      performanceMetrics: {
        checkTime: 0,
        cacheHits: 0,
        dbQueries: 0
      }
    };

    try {
      const db = await dbHelper.openDB();
      
      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          console.warn(`Store '${storeName}' does not exist in database`);
          continue;
        }

        console.log(`🔍 Checking referential integrity for store: ${storeName}`);
        
        const storeResult = await this.checkStoreReferentialIntegrity(
          storeName, 
          { includeOrphans, includeMissing, deepCheck, useCache }
        );
        
        report.storeResults[storeName] = storeResult;
        report.overall.storesChecked++;
        report.overall.constraintsChecked += storeResult.constraintsChecked;
        
        if (!storeResult.valid) {
          report.overall.valid = false;
          report.overall.violationCount += storeResult.violations.length;
          report.violations.push(...storeResult.violations);
          report.repairSuggestions.push(...storeResult.repairSuggestions);
        }

        report.performanceMetrics.cacheHits += storeResult.performanceMetrics.cacheHits;
        report.performanceMetrics.dbQueries += storeResult.performanceMetrics.dbQueries;
      }

      const endTime = performance.now();
      report.performanceMetrics.checkTime = endTime - startTime;

      // Generate integrity score
      report.integrityScore = this.calculateIntegrityScore(report);

      console.log(`✅ Referential integrity check completed in ${report.performanceMetrics.checkTime.toFixed(2)}ms`);
      console.log(`📊 Integrity Score: ${report.integrityScore}% (${report.overall.violationCount} violations found)`);

      return report;

    } catch (error) {
      console.error('❌ Referential integrity check failed:', error);
      report.overall.valid = false;
      report.error = {
        message: error.message,
        stack: error.stack
      };
      
      await this.reportIntegrityError('check_all_integrity', error, report);
      return report;
    }
  }

  /**
   * Check referential integrity for a specific store
   * @param {string} storeName - Name of the store to check
   * @param {Object} options - Check options
   * @returns {Promise<Object>} - Store integrity result
   */
  static async checkStoreReferentialIntegrity(storeName, options = {}) {
    const {
      includeOrphans = true,
      includeMissing = true,
      deepCheck = false,
      useCache = true
    } = options;

    const cacheKey = `${storeName}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (useCache && this.integrityCache.has(cacheKey)) {
      const cached = this.integrityCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return {
          ...cached.result,
          performanceMetrics: {
            ...cached.result.performanceMetrics,
            cacheHits: 1,
            dbQueries: 0
          }
        };
      }
    }

    const startTime = performance.now();
    const result = {
      storeName,
      valid: true,
      violations: [],
      repairSuggestions: [],
      constraintsChecked: 0,
      performanceMetrics: {
        checkTime: 0,
        cacheHits: 0,
        dbQueries: 0
      }
    };

    try {
      const constraints = DataIntegritySchemas.getReferentialConstraints(storeName);
      
      if (constraints.length === 0) {
        console.log(`📝 No referential constraints defined for store: ${storeName}`);
        return result;
      }

      const db = await dbHelper.openDB();
      const storeData = await this.getAllStoreData(db, storeName);
      result.performanceMetrics.dbQueries++;

      for (const constraint of constraints) {
        result.constraintsChecked++;
        console.log(`🔗 Checking constraint: ${storeName}.${constraint.field} -> ${constraint.references.store}.${constraint.references.field}`);

        if (includeMissing) {
          const missingRefs = await this.findMissingReferences(
            db, 
            storeName, 
            storeData, 
            constraint,
            deepCheck
          );
          
          if (missingRefs.length > 0) {
            result.valid = false;
            result.violations.push(...missingRefs);
            result.repairSuggestions.push(...this.generateRepairSuggestions(missingRefs, constraint));
          }
          result.performanceMetrics.dbQueries++;
        }

        if (includeOrphans) {
          const orphans = await this.findOrphanedRecords(
            db, 
            storeName, 
            storeData, 
            constraint,
            deepCheck
          );
          
          if (orphans.length > 0) {
            result.valid = false;
            result.violations.push(...orphans);
            result.repairSuggestions.push(...this.generateRepairSuggestions(orphans, constraint));
          }
          result.performanceMetrics.dbQueries++;
        }
      }

      // Check for circular references if deep check is enabled
      if (deepCheck) {
        const circularRefs = await this.findCircularReferences(db, storeName, storeData);
        if (circularRefs.length > 0) {
          result.valid = false;
          result.violations.push(...circularRefs);
          result.repairSuggestions.push(...this.generateRepairSuggestions(circularRefs));
        }
        result.performanceMetrics.dbQueries++;
      }

      const endTime = performance.now();
      result.performanceMetrics.checkTime = endTime - startTime;

      // Cache the result
      if (useCache) {
        this.integrityCache.set(cacheKey, {
          timestamp: Date.now(),
          result: { ...result }
        });
      }

      return result;

    } catch (error) {
      console.error(`❌ Store integrity check failed for ${storeName}:`, error);
      result.valid = false;
      result.error = {
        message: error.message,
        stack: error.stack
      };
      
      await this.reportIntegrityError('check_store_integrity', error, { storeName, options });
      return result;
    }
  }

  /**
   * Find missing references (foreign key violations)
   * @param {IDBDatabase} db - IndexedDB database instance
   * @param {string} storeName - Source store name
   * @param {Array} storeData - Source store data
   * @param {Object} constraint - Constraint definition
   * @param {boolean} deepCheck - Whether to perform deep validation
   * @returns {Promise<Array>} - Array of violation objects
   */
  static async findMissingReferences(db, storeName, storeData, constraint, deepCheck = false) {
    const violations = [];
    const { field, references } = constraint;
    const { store: refStore, field: refField } = references;

    // Get referenced store data
    const referencedData = await this.getAllStoreData(db, refStore);
    const referencedIds = new Set(referencedData.map(item => this.getFieldValue(item, refField)));

    for (const record of storeData) {
      const foreignKeyValue = this.getFieldValue(record, field);
      
      // Skip null/undefined references if not required
      if (!constraint.required && (foreignKeyValue === null || foreignKeyValue === undefined)) {
        continue;
      }

      // Handle array of references (for nested structures)
      const foreignKeyValues = Array.isArray(foreignKeyValue) ? foreignKeyValue : [foreignKeyValue];

      for (const fkValue of foreignKeyValues) {
        if (fkValue !== null && fkValue !== undefined && !referencedIds.has(fkValue)) {
          const violation = {
            type: this.VIOLATION_TYPES.MISSING_REFERENCE,
            storeName,
            recordId: this.getRecordId(record),
            field,
            value: fkValue,
            constraint,
            message: `Record references non-existent ${refStore}.${refField} = ${fkValue}`,
            severity: constraint.required ? 'critical' : 'warning',
            timestamp: new Date().toISOString()
          };

          if (deepCheck) {
            violation.recordPreview = this.sanitizeRecord(record);
            violation.validReferences = Array.from(referencedIds).slice(0, 10); // Show some valid options
          }

          violations.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Find orphaned records (records that should be referenced but aren't)
   * @param {IDBDatabase} db - IndexedDB database instance
   * @param {string} storeName - Source store name
   * @param {Array} storeData - Source store data
   * @param {Object} constraint - Constraint definition
   * @param {boolean} deepCheck - Whether to perform deep validation
   * @returns {Promise<Array>} - Array of violation objects
   */
  static async findOrphanedRecords(db, storeName, storeData, constraint, deepCheck = false) {
    const violations = [];
    
    // Find constraints where other stores reference this store
    const reverseConstraints = this.findReverseConstraints(storeName, constraint);
    
    for (const reverseConstraint of reverseConstraints) {
      const referencingStore = reverseConstraint.storeName;
      const referencingData = await this.getAllStoreData(db, referencingStore);
      
      // Get all foreign key values that reference this store
      const referencedIds = new Set();
      for (const record of referencingData) {
        const fkValue = this.getFieldValue(record, reverseConstraint.field);
        if (fkValue !== null && fkValue !== undefined) {
          if (Array.isArray(fkValue)) {
            fkValue.forEach(val => referencedIds.add(val));
          } else {
            referencedIds.add(fkValue);
          }
        }
      }

      // Find records in current store that are not referenced
      for (const record of storeData) {
        const recordId = this.getFieldValue(record, constraint.references.field);
        
        if (recordId && !referencedIds.has(recordId)) {
          const violation = {
            type: this.VIOLATION_TYPES.ORPHANED_RECORD,
            storeName,
            recordId: this.getRecordId(record),
            field: constraint.references.field,
            value: recordId,
            referencingStore,
            message: `Record is not referenced by any ${referencingStore} records`,
            severity: 'warning',
            timestamp: new Date().toISOString()
          };

          if (deepCheck) {
            violation.recordPreview = this.sanitizeRecord(record);
            violation.lastModified = record.lastModified || record.lastUpdated;
          }

          violations.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Find circular references in the data
   * @param {IDBDatabase} db - IndexedDB database instance
   * @param {string} storeName - Store name to check
   * @param {Array} storeData - Store data
   * @returns {Promise<Array>} - Array of circular reference violations
   */
  static async findCircularReferences(db, storeName, storeData) {
    const violations = [];
    
    // Only check stores that might have circular references
    if (!['problem_relationships', 'tag_relationships'].includes(storeName)) {
      return violations;
    }

    const visited = new Set();
    const recursionStack = new Set();

    const detectCycle = (recordId, path = []) => {
      if (recursionStack.has(recordId)) {
        // Found a cycle
        const cycleStart = path.indexOf(recordId);
        const cyclePath = path.slice(cycleStart).concat(recordId);
        
        return {
          type: this.VIOLATION_TYPES.CIRCULAR_REFERENCE,
          storeName,
          recordId,
          path: cyclePath,
          message: `Circular reference detected: ${cyclePath.join(' -> ')}`,
          severity: 'warning',
          timestamp: new Date().toISOString()
        };
      }

      if (visited.has(recordId)) {
        return null; // Already processed
      }

      visited.add(recordId);
      recursionStack.add(recordId);

      // Find related records based on store type
      const relatedRecords = this.getRelatedRecords(storeData, recordId, storeName);
      
      for (const relatedId of relatedRecords) {
        const violation = detectCycle(relatedId, [...path, recordId]);
        if (violation) {
          return violation;
        }
      }

      recursionStack.delete(recordId);
      return null;
    };

    // Check each record for cycles
    for (const record of storeData) {
      const recordId = this.getRecordId(record);
      if (!visited.has(recordId)) {
        const violation = detectCycle(recordId);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Get related record IDs based on store type
   * @param {Array} storeData - Store data
   * @param {*} recordId - Current record ID
   * @param {string} storeName - Store name
   * @returns {Array} - Array of related record IDs
   */
  static getRelatedRecords(storeData, recordId, storeName) {
    const relatedIds = [];

    for (const record of storeData) {
      switch (storeName) {
        case 'problem_relationships':
          if (record.problemId1 === recordId) {
            relatedIds.push(record.problemId2);
          }
          if (record.problemId2 === recordId) {
            relatedIds.push(record.problemId1);
          }
          break;
        case 'tag_relationships':
          if (record.id === recordId && record.parentTag) {
            relatedIds.push(record.parentTag);
          }
          if (record.parentTag === recordId) {
            relatedIds.push(record.id);
          }
          break;
        default:
          // Generic relationship detection
          break;
      }
    }

    return relatedIds;
  }

  /**
   * Find reverse constraints (stores that reference the given store)
   * @param {string} targetStore - Store that is being referenced
   * @param {Object} constraint - Current constraint
   * @returns {Array} - Array of reverse constraints
   */
  static findReverseConstraints(targetStore, constraint) {
    const reverseConstraints = [];
    const allConstraints = DataIntegritySchemas.getAllReferentialConstraints();

    for (const [storeName, constraints] of Object.entries(allConstraints)) {
      for (const storeConstraint of constraints) {
        if (storeConstraint.references.store === targetStore) {
          reverseConstraints.push({
            storeName,
            field: storeConstraint.field,
            references: storeConstraint.references,
            required: storeConstraint.required
          });
        }
      }
    }

    return reverseConstraints;
  }

  /**
   * Generate repair suggestions for violations
   * @param {Array} violations - Array of violation objects
   * @param {Object} constraint - Constraint that was violated
   * @returns {Array} - Array of repair suggestion objects
   */
  static generateRepairSuggestions(violations, constraint = null) {
    const suggestions = [];

    for (const violation of violations) {
      let suggestion;

      switch (violation.type) {
        case this.VIOLATION_TYPES.MISSING_REFERENCE:
          suggestion = {
            violationId: this.getViolationId(violation),
            strategy: constraint?.required ? this.REPAIR_STRATEGIES.MANUAL_REVIEW : this.REPAIR_STRATEGIES.SET_NULL,
            description: constraint?.required 
              ? 'Manual review required - critical reference missing'
              : 'Set foreign key to null',
            automated: !constraint?.required,
            risk: constraint?.required ? 'high' : 'low',
            action: {
              type: 'update',
              storeName: violation.storeName,
              recordId: violation.recordId,
              field: violation.field,
              newValue: constraint?.required ? undefined : null
            }
          };
          break;

        case this.VIOLATION_TYPES.ORPHANED_RECORD:
          suggestion = {
            violationId: this.getViolationId(violation),
            strategy: this.REPAIR_STRATEGIES.DELETE_ORPHAN,
            description: 'Delete orphaned record (no references)',
            automated: true,
            risk: 'medium',
            action: {
              type: 'delete',
              storeName: violation.storeName,
              recordId: violation.recordId
            }
          };
          break;

        case this.VIOLATION_TYPES.CIRCULAR_REFERENCE:
          suggestion = {
            violationId: this.getViolationId(violation),
            strategy: this.REPAIR_STRATEGIES.MANUAL_REVIEW,
            description: 'Manual review required - circular reference detected',
            automated: false,
            risk: 'high',
            action: {
              type: 'manual',
              storeName: violation.storeName,
              cyclePath: violation.path
            }
          };
          break;

        default:
          suggestion = {
            violationId: this.getViolationId(violation),
            strategy: this.REPAIR_STRATEGIES.MANUAL_REVIEW,
            description: 'Manual review required - unknown violation type',
            automated: false,
            risk: 'high'
          };
          break;
      }

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Execute repair suggestions
   * @param {Array} suggestions - Array of repair suggestions
   * @param {Object} options - Repair options
   * @returns {Promise<Object>} - Repair execution result
   */
  static async executeRepairs(suggestions, options = {}) {
    const {
      dryRun = false,
      automatedOnly = true,
      maxRepairs = 100,
      createBackup = true
    } = options;

    console.log(`🔧 Executing ${dryRun ? 'dry run' : 'actual'} repairs for ${suggestions.length} suggestions...`);

    const result = {
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      backup: null
    };

    try {
      // Create backup if requested
      if (createBackup && !dryRun) {
        result.backup = await this.createRepairBackup();
        console.log(`💾 Created repair backup: ${result.backup.backupId}`);
      }

      const db = await dbHelper.openDB();
      const suitableRepairs = suggestions
        .filter(s => !automatedOnly || s.automated)
        .slice(0, maxRepairs);

      for (const suggestion of suitableRepairs) {
        try {
          result.attempted++;
          
          const repairResult = await this.executeRepair(db, suggestion, dryRun);
          result.results.push(repairResult);
          
          if (repairResult.success) {
            result.successful++;
            console.log(`✅ Repair successful: ${suggestion.description}`);
          } else {
            result.failed++;
            console.error(`❌ Repair failed: ${repairResult.error}`);
          }

        } catch (error) {
          result.failed++;
          result.results.push({
            violationId: suggestion.violationId,
            success: false,
            error: error.message,
            suggestion
          });
          console.error(`❌ Repair exception:`, error);
        }
      }

      result.skipped = suggestions.length - result.attempted;

      console.log(`🏁 Repair execution completed: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`);

      return result;

    } catch (error) {
      console.error('❌ Repair execution failed:', error);
      result.error = {
        message: error.message,
        stack: error.stack
      };
      
      await this.reportIntegrityError('execute_repairs', error, { suggestions, options });
      return result;
    }
  }

  /**
   * Execute a single repair
   * @param {IDBDatabase} db - Database instance
   * @param {Object} suggestion - Repair suggestion
   * @param {boolean} dryRun - Whether this is a dry run
   * @returns {Promise<Object>} - Repair result
   */
  static async executeRepair(db, suggestion, dryRun = false) {
    const { action } = suggestion;
    
    if (dryRun) {
      return {
        violationId: suggestion.violationId,
        success: true,
        dryRun: true,
        action: action.type,
        description: `Would ${action.type} ${action.storeName} record`
      };
    }

    switch (action.type) {
      case 'update':
        return await this.executeUpdateRepair(db, action);
      case 'delete':
        return await this.executeDeleteRepair(db, action);
      default:
        return {
          violationId: suggestion.violationId,
          success: false,
          error: `Unsupported repair action: ${action.type}`
        };
    }
  }

  /**
   * Execute update repair (set field to null or new value)
   * @param {IDBDatabase} db - Database instance
   * @param {Object} action - Repair action
   * @returns {Promise<Object>} - Update result
   */
  static async executeUpdateRepair(db, action) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([action.storeName], 'readwrite');
      const store = transaction.objectStore(action.storeName);
      
      // Get the record first
      const getRequest = store.get(action.recordId);
      
      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (!record) {
          resolve({
            violationId: action.violationId,
            success: false,
            error: 'Record not found'
          });
          return;
        }

        // Update the field
        this.setFieldValue(record, action.field, action.newValue);
        record.lastUpdated = new Date().toISOString();

        // Save the updated record
        const putRequest = store.put(record);
        
        putRequest.onsuccess = () => {
          resolve({
            violationId: action.violationId,
            success: true,
            action: 'updated',
            field: action.field,
            newValue: action.newValue
          });
        };

        putRequest.onerror = () => {
          resolve({
            violationId: action.violationId,
            success: false,
            error: putRequest.error?.message || 'Update failed'
          });
        };
      };

      getRequest.onerror = () => {
        resolve({
          violationId: action.violationId,
          success: false,
          error: getRequest.error?.message || 'Failed to get record'
        });
      };
    });
  }

  /**
   * Execute delete repair (remove orphaned record)
   * @param {IDBDatabase} db - Database instance
   * @param {Object} action - Repair action
   * @returns {Promise<Object>} - Delete result
   */
  static async executeDeleteRepair(db, action) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([action.storeName], 'readwrite');
      const store = transaction.objectStore(action.storeName);
      
      const deleteRequest = store.delete(action.recordId);
      
      deleteRequest.onsuccess = () => {
        resolve({
          violationId: action.violationId,
          success: true,
          action: 'deleted',
          recordId: action.recordId
        });
      };

      deleteRequest.onerror = () => {
        resolve({
          violationId: action.violationId,
          success: false,
          error: deleteRequest.error?.message || 'Delete failed'
        });
      };
    });
  }

  /**
   * Create a backup before performing repairs
   * @returns {Promise<Object>} - Backup information
   */
  static async createRepairBackup() {
    // This would integrate with the existing backup system
    const backupId = `integrity_repair_${Date.now()}`;
    
    // For now, return a mock backup object
    // In production, this would call the actual backup service
    return {
      backupId,
      timestamp: new Date().toISOString(),
      type: 'integrity_repair',
      description: 'Backup created before referential integrity repairs'
    };
  }

  /**
   * Calculate integrity score based on violations
   * @param {Object} report - Integrity report
   * @returns {number} - Integrity score (0-100)
   */
  static calculateIntegrityScore(report) {
    const totalConstraints = report.overall.constraintsChecked;
    const violations = report.overall.violationCount;
    
    if (totalConstraints === 0) {
      return 100; // Perfect score if no constraints to check
    }

    // Weight violations by severity
    let weightedViolations = 0;
    for (const violation of report.violations) {
      switch (violation.severity) {
        case 'critical':
          weightedViolations += 3;
          break;
        case 'warning':
          weightedViolations += 1;
          break;
        default:
          weightedViolations += 2;
          break;
      }
    }

    // Calculate score (violations reduce score more than constraints)
    const maxPossibleScore = totalConstraints * 3; // Assuming all could be critical
    const score = Math.max(0, ((maxPossibleScore - weightedViolations) / maxPossibleScore) * 100);
    
    return Math.round(score);
  }

  // Helper methods

  static async getAllStoreData(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  static getFieldValue(record, fieldPath) {
    if (!fieldPath) return undefined;
    
    const fields = fieldPath.split('.');
    let value = record;
    
    for (const field of fields) {
      if (value && typeof value === 'object') {
        value = value[field];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  static setFieldValue(record, fieldPath, value) {
    const fields = fieldPath.split('.');
    let current = record;
    
    for (let i = 0; i < fields.length - 1; i++) {
      if (!current[fields[i]]) {
        current[fields[i]] = {};
      }
      current = current[fields[i]];
    }
    
    current[fields[fields.length - 1]] = value;
  }

  static getRecordId(record) {
    // Try common ID fields
    return record.id || record.leetCodeID || record.tag || record.sessionId || 
           record.backupId || record.problemId || 'unknown';
  }

  static getViolationId(violation) {
    return `${violation.storeName}_${violation.type}_${violation.recordId}_${Date.now()}`;
  }

  static sanitizeRecord(record) {
    // Return a safe preview of the record for logging
    const preview = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string' && value.length > 50) {
        preview[key] = value.substring(0, 50) + '...';
      } else if (Array.isArray(value) && value.length > 5) {
        preview[key] = value.slice(0, 5).concat(['...']);
      } else {
        preview[key] = value;
      }
    }
    return preview;
  }

  static async reportIntegrityError(operation, error, context) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `integrity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: `Referential integrity ${operation} failed: ${error.message}`,
        stack: error.stack,
        section: 'Data Integrity',
        errorType: 'referential_integrity',
        severity: 'high',
        userContext: context
      });
    } catch (reportError) {
      console.warn('Failed to report integrity error:', reportError);
    }
  }

  /**
   * Clear integrity cache
   */
  static clearCache() {
    this.integrityCache.clear();
    console.log('🗑️ Referential integrity cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  static getCacheStats() {
    return {
      size: this.integrityCache.size,
      timeout: this.cacheTimeout,
      keys: Array.from(this.integrityCache.keys())
    };
  }
}

export default ReferentialIntegrityService;