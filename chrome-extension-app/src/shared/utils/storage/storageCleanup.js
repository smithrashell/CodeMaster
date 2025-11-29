/**
 * Storage Cleanup Manager - Periodic Session Cleanup
 *
 * NOTE: As of Issue #193, expired sessions are now deleted immediately upon regeneration.
 * This manager is kept for potential future edge case handling (orphaned data, crashes).
 * Preserves completed sessions forever.
 * Runs every 24 hours while extension is active.
 */

import { openDatabase } from '../../db/connectionUtils.js';
import logger from '../logging/logger.js';

export default class StorageCleanupManager {
  /**
   * Cleanup interval timer ID
   */
  static cleanupIntervalId = null;

  /**
   * Retention policies for different session types (in days)
   * NOTE: Expired sessions are now deleted immediately (Issue #193), so this cleanup
   * only handles edge cases like orphaned data from crashes.
   */
  static RETENTION_POLICY = {
    expired: 0,    // Delete any remaining expired sessions immediately (edge cases only)
    completed: null // NEVER delete completed sessions
  };

  /**
   * Start periodic cleanup (runs every 24 hours)
   */
  static startPeriodicCleanup() {
    // Clear any existing interval
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }

    // Run cleanup immediately on start
    this.performAutomaticCleanup().catch(error => {
      logger.error('❌ Initial cleanup failed:', error);
    });

    // Set up 24-hour interval (24 * 60 * 60 * 1000 ms)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    this.cleanupIntervalId = setInterval(() => {
      logger.info('🕐 Running scheduled 24-hour cleanup...');
      this.performAutomaticCleanup().catch(error => {
        logger.error('❌ Scheduled cleanup failed:', error);
      });
    }, TWENTY_FOUR_HOURS);

    logger.info('✅ Periodic cleanup started (runs every 24 hours)');
  }

  /**
   * Stop periodic cleanup
   */
  static stopPeriodicCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      logger.info('🛑 Periodic cleanup stopped');
    }
  }

  /**
   * Delete old expired sessions, preserve completed sessions
   * @returns {Promise<Object>} Cleanup result with counts and details
   */
  static async performAutomaticCleanup() {
    try {
      logger.info('🧹 Starting automatic session cleanup...');

      const db = await openDatabase();
      if (!db) {
        throw new Error('Failed to open database for cleanup');
      }

      const transaction = db.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');

      // Get all sessions
      const allSessions = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      logger.info(`📊 Found ${allSessions.length} total sessions in database`);

      const now = Date.now();
      const deletedSessions = [];
      const stats = {
        expired: { checked: 0, deleted: 0 },
        completed: { checked: 0, preserved: 0 },
        active: 0
      };

      // Process each session
      for (const session of allSessions) {
        const status = session.status || 'unknown';
        const ageInDays = (now - new Date(session.date)) / (1000 * 60 * 60 * 24);

        // NEVER delete completed sessions
        if (status === 'completed') {
          stats.completed.checked++;
          stats.completed.preserved++;
          continue;
        }

        let shouldDelete = false;
        let reason = '';

        // Delete any remaining expired sessions immediately (edge case cleanup only)
        if (status === 'expired' && ageInDays > this.RETENTION_POLICY.expired) {
          shouldDelete = true;
          reason = `Expired session older than ${this.RETENTION_POLICY.expired} days`;
          stats.expired.checked++;
        }
        else if (status === 'in_progress') {
          stats.active++;
        }

        if (shouldDelete) {
          try {
            // Log warning if we find expired sessions (should not happen with Issue #193 fix)
            if (status === 'expired') {
              logger.warn(`🔍 Found orphaned expired session ${session.id.substring(0, 8)} - this should not happen with Issue #193 fix`);
            }
            
            await store.delete(session.id);
            deletedSessions.push({
              id: session.id.substring(0, 8),
              status,
              age: Math.round(ageInDays),
              reason
            });

            if (status === 'expired') {
              stats.expired.deleted++;
            }
          } catch (deleteError) {
            logger.error(`❌ Failed to delete session ${session.id}:`, deleteError);
          }
        }
      }

      logger.info(`✅ Cleanup completed: Deleted ${deletedSessions.length} old sessions`);
      logger.info(`📊 Cleanup stats:`, stats);

      return {
        deletedCount: deletedSessions.length,
        message: `Deleted ${deletedSessions.length} old sessions (completed sessions preserved)`,
        details: {
          stats,
          deletedSessions: deletedSessions.slice(0, 10), // Show first 10
          totalChecked: allSessions.length,
          retentionPolicy: this.RETENTION_POLICY
        }
      };
    } catch (error) {
      logger.error('❌ Automatic cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get preview of sessions that would be deleted
   * @returns {Promise<Array>} Array of cleanup recommendations
   */
  static async getCleanupRecommendations() {
    try {
      const db = await openDatabase();
      if (!db) {
        return [];
      }

      const transaction = db.transaction('sessions', 'readonly');
      const store = transaction.objectStore('sessions');

      const allSessions = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      const now = Date.now();
      const recommendations = [];
      const counts = {
        old_expired: 0
      };

      for (const session of allSessions) {
        const status = session.status;
        if (status === 'completed') continue;

        const ageInDays = (now - new Date(session.date)) / (1000 * 60 * 60 * 24);

        if (status === 'expired' && ageInDays > this.RETENTION_POLICY.expired) {
          counts.old_expired++;
        }
      }

      if (counts.old_expired > 0) {
        recommendations.push({
          type: 'old_expired',
          count: counts.old_expired,
          action: 'delete',
          priority: 'low',
          message: `${counts.old_expired} expired session(s) ready for deletion (older than ${this.RETENTION_POLICY.expired} days)`
        });
      }

      return recommendations;
    } catch (error) {
      logger.error('❌ Failed to get cleanup recommendations:', error);
      return [];
    }
  }

  /**
   * Clean up old data (alias for backward compatibility)
   * @returns {Promise<Object>} Cleanup result
   */
  static async cleanupOldData() {
    return await this.performAutomaticCleanup();
  }
}