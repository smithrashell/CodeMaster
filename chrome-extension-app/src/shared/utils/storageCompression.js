/**
 * Storage Compression Utility - Minimal Stub Implementation
 * 
 * Provides basic data preparation for Chrome Storage without actual compression.
 * This is a lightweight stub to maintain compatibility after cleanup.
 */

export default class StorageCompression {
  /**
   * Prepare data for Chrome Storage (stub - no compression)
   * @param {*} data - Data to prepare
   * @returns {Promise<string>} JSON string of the data
   */
  static prepareForChromeStorage(data) {
    try {
      return JSON.stringify(data);
    } catch (error) {
      throw new Error(`Failed to prepare data for Chrome Storage: ${error.message}`);
    }
  }

  /**
   * Retrieve data from Chrome Storage (stub - simple parse)
   * @param {string} compressedData - JSON string to parse
   * @returns {Promise<*>} Parsed data
   */
  static retrieveFromChromeStorage(compressedData) {
    try {
      if (!compressedData) return null;
      return JSON.parse(compressedData);
    } catch (error) {
      throw new Error(`Failed to retrieve data from Chrome Storage: ${error.message}`);
    }
  }
}