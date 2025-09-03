import logger from "../utils/logger.js";
import { handleDatabaseUpgrade } from "./migrationOrchestrator.js";

/**
 * Creates and configures a database connection request
 * @param {string} dbName - Database name
 * @param {number} version - Database version
 * @param {Object} context - Execution context
 * @param {string} stack - Stack trace
 * @returns {Promise<IDBDatabase>} Database instance
 */
export function createDatabaseConnection(dbName, version, context, stack) {
  return new Promise((resolve, reject) => {
    // DEBUGGING: Log the actual IndexedDB.open call
    logger.group(`💾 INDEXEDDB OPEN: Opening ${dbName} v${version}`);
    console.info('🕐 Time:', new Date().toISOString());
    console.log('📍 Database connection context:', {
      contextType: context.contextType,
      location: context.location
    });
    
    const request = indexedDB.open(dbName, version);
    logger.debug('📨 IndexedDB request created');

    // Configure request handlers
    configureRequestHandlers(request, resolve, reject, context, stack);
  });
}

/**
 * Configures success, error, and upgrade handlers for the database request
 * @param {IDBOpenDBRequest} request - The database open request
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 * @param {Object} context - Execution context
 * @param {string} stack - Stack trace
 */
function configureRequestHandlers(request, resolve, reject, context, stack) {
  request.onupgradeneeded = (event) => {
    handleDatabaseUpgrade(event);
  };

  request.onsuccess = (event) => {
    const db = event.target.result;
    
    // DEBUGGING: Log successful database connection
    logSuccessfulConnection(db, context, stack);
    
    resolve(db);
  };

  request.onerror = (event) => {
    reject(new Error(`❌ DB Error: ${event.target.error}`));
  };
}

/**
 * Logs successful database connection with detailed information
 * @param {IDBDatabase} db - Database instance
 * @param {Object} context - Execution context
 * @param {string} stack - Stack trace
 */
function logSuccessfulConnection(db, context, stack) {
  logger.group('🎉 DATABASE OPENED SUCCESSFULLY');
  console.info('🕐 Time:', new Date().toISOString());
  console.info('📍 Context:', context.contextType);
  console.info('🆔 Database Name:', db.name);
  console.info('📄 Version:', db.version);
  console.info('📊 Object Stores:', Array.from(db.objectStoreNames));
  console.info('🧵 Call Stack:', stack.split('\n')[0]); // Just first line of stack
  logger.groupEnd();
}

/**
 * Logs new database connection creation warning
 */
export function logNewConnectionWarning() {
  console.log('🚨 CREATING NEW DATABASE CONNECTION - This should only happen ONCE!');
}

/**
 * Logs cached database connection usage
 */
export function logCachedConnection() {
  logger.debug('✅ Returning cached database connection');
}

/**
 * Simple database opener for services that need database access
 * @returns {Promise<IDBDatabase>} Database instance
 */
export function openDatabase() {
  const dbName = "review";
  const version = 36;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      logger.error('Failed to open database:', event.target.error);
      reject(event.target.error);
    };
    
    request.onupgradeneeded = () => {
      // For services, we'll just handle basic upgrade
      logger.warn('Database upgrade needed but handling minimal upgrade for service');
    };
  });
}