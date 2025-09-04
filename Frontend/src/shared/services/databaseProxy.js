/**
 * Database Proxy Service
 * 
 * Handles database operations for content scripts by proxying requests
 * to the background script to avoid multiple IndexedDB contexts.
 */

export class DatabaseProxy {
  constructor() {
    this.isContentScript = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }

  /**
   * Proxy database operation to background script
   */
  async proxyDatabaseOperation(operation, params = {}) {
    if (!this.isContentScript) {
      throw new Error('DatabaseProxy should only be used in content scripts');
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'DATABASE_OPERATION',
        operation: operation,
        params: params
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        resolve(response.data);
      });
    });
  }

  /**
   * Get a record from the database
   */
  async getRecord(storeName, id) {
    return this.proxyDatabaseOperation('getRecord', { storeName, id });
  }

  /**
   * Add a record to the database
   */
  async addRecord(storeName, record) {
    return this.proxyDatabaseOperation('addRecord', { storeName, record });
  }

  /**
   * Update a record in the database
   */
  async updateRecord(storeName, id, record) {
    return this.proxyDatabaseOperation('updateRecord', { storeName, id, record });
  }

  /**
   * Delete a record from the database
   */
  async deleteRecord(storeName, id) {
    return this.proxyDatabaseOperation('deleteRecord', { storeName, id });
  }

  /**
   * Get all records from a store
   */
  async getAllFromStore(storeName) {
    return this.proxyDatabaseOperation('getAllFromStore', { storeName });
  }
}

export const databaseProxy = new DatabaseProxy();