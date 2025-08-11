/**
 * Storage Compression Utilities for CodeMaster
 *
 * Provides data compression and optimization for Chrome Storage to maximize
 * the available 10MB quota and ensure efficient data storage.
 */

export class StorageCompression {
  // Compression methods
  static COMPRESSION_TYPE = {
    NONE: "none",
    JSON_MINIFY: "json_minify",
    LZ_STRING: "lz_string", // Would require library
    SIMPLE_COMPRESS: "simple_compress",
  };

  // Size thresholds for compression
  static SIZE_THRESHOLDS = {
    SMALL: 1024, // 1KB - no compression needed
    MEDIUM: 4096, // 4KB - JSON minify
    LARGE: 8192, // 8KB - full compression
  };

  /**
   * Compress data based on size and type
   */
  static compressData(data, forceCompression = false) {
    try {
      const originalData = JSON.stringify(data);
      const originalSize = new Blob([originalData]).size;

      // Determine compression strategy
      const compressionType = this.selectCompressionType(
        originalSize,
        forceCompression
      );

      let compressedData;
      let metadata;

      switch (compressionType) {
        case this.COMPRESSION_TYPE.NONE:
          compressedData = originalData;
          metadata = {
            compressed: false,
            method: this.COMPRESSION_TYPE.NONE,
            originalSize,
            compressedSize: originalSize,
            ratio: 1.0,
          };
          break;

        case this.COMPRESSION_TYPE.JSON_MINIFY:
          compressedData = this.jsonMinify(originalData);
          metadata = {
            compressed: true,
            method: this.COMPRESSION_TYPE.JSON_MINIFY,
            originalSize,
            compressedSize: new Blob([compressedData]).size,
            ratio: new Blob([compressedData]).size / originalSize,
          };
          break;

        case this.COMPRESSION_TYPE.SIMPLE_COMPRESS:
          compressedData = this.simpleCompress(originalData);
          metadata = {
            compressed: true,
            method: this.COMPRESSION_TYPE.SIMPLE_COMPRESS,
            originalSize,
            compressedSize: new Blob([compressedData]).size,
            ratio: new Blob([compressedData]).size / originalSize,
          };
          break;

        default:
          throw new Error(`Unsupported compression type: ${compressionType}`);
      }

      return {
        data: compressedData,
        metadata,
        success: true,
      };
    } catch (error) {
      console.warn("Compression failed, returning original data:", error);
      const originalData = JSON.stringify(data);
      return {
        data: originalData,
        metadata: {
          compressed: false,
          method: this.COMPRESSION_TYPE.NONE,
          originalSize: new Blob([originalData]).size,
          compressedSize: new Blob([originalData]).size,
          ratio: 1.0,
          error: error.message,
        },
        success: false,
      };
    }
  }

  /**
   * Decompress data back to original format
   */
  static decompressData(compressedData, metadata) {
    try {
      if (!metadata.compressed) {
        return {
          data: JSON.parse(compressedData),
          success: true,
        };
      }

      let originalData;

      switch (metadata.method) {
        case this.COMPRESSION_TYPE.JSON_MINIFY:
          originalData = compressedData; // Already valid JSON
          break;

        case this.COMPRESSION_TYPE.SIMPLE_COMPRESS:
          originalData = this.simpleDecompress(compressedData);
          break;

        default:
          throw new Error(
            `Unsupported decompression method: ${metadata.method}`
          );
      }

      return {
        data: JSON.parse(originalData),
        success: true,
      };
    } catch (error) {
      console.error("Decompression failed:", error);
      return {
        data: null,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Select appropriate compression type based on data size
   */
  static selectCompressionType(size, forceCompression = false) {
    if (forceCompression) {
      return this.COMPRESSION_TYPE.SIMPLE_COMPRESS;
    }

    if (size <= this.SIZE_THRESHOLDS.SMALL) {
      return this.COMPRESSION_TYPE.NONE;
    } else if (size <= this.SIZE_THRESHOLDS.MEDIUM) {
      return this.COMPRESSION_TYPE.JSON_MINIFY;
    } else {
      return this.COMPRESSION_TYPE.SIMPLE_COMPRESS;
    }
  }

  /**
   * JSON minification (remove unnecessary whitespace)
   */
  static jsonMinify(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed); // This removes all unnecessary whitespace
    } catch (error) {
      console.warn("JSON minification failed:", error);
      return jsonString;
    }
  }

  /**
   * Simple compression using basic string operations
   */
  static simpleCompress(data) {
    try {
      // Replace common patterns in JSON data
      let compressed = data;

      // Common JSON patterns
      const patterns = [
        { find: '","', replace: '"|"' },
        { find: '":"', replace: '":"' },
        { find: ',"', replace: '~"' },
        { find: '":true', replace: '":1' },
        { find: '":false', replace: '":0' },
        { find: '":null', replace: '":n' },
        { find: "timestamp", replace: "ts" },
        { find: "sessionId", replace: "sId" },
        { find: "problemId", replace: "pId" },
        { find: "leetCodeID", replace: "lId" },
        { find: "lastUpdated", replace: "lu" },
      ];

      patterns.forEach((pattern) => {
        compressed = compressed.split(pattern.find).join(pattern.replace);
      });

      // Add compression marker
      return `SIMPLE_COMPRESSED:${compressed}`;
    } catch (error) {
      console.warn("Simple compression failed:", error);
      return data;
    }
  }

  /**
   * Simple decompression
   */
  static simpleDecompress(compressedData) {
    try {
      if (!compressedData.startsWith("SIMPLE_COMPRESSED:")) {
        return compressedData;
      }

      let decompressed = compressedData.substring("SIMPLE_COMPRESSED:".length);

      // Reverse the compression patterns
      const patterns = [
        { find: '"|"', replace: '","' },
        { find: '~"', replace: ',"' },
        { find: '":1', replace: '":true' },
        { find: '":0', replace: '":false' },
        { find: '":n', replace: '":null' },
        { find: "ts", replace: "timestamp" },
        { find: "sId", replace: "sessionId" },
        { find: "pId", replace: "problemId" },
        { find: "lId", replace: "leetCodeID" },
        { find: "lu", replace: "lastUpdated" },
      ];

      patterns.forEach((pattern) => {
        decompressed = decompressed.split(pattern.find).join(pattern.replace);
      });

      return decompressed;
    } catch (error) {
      console.warn("Simple decompression failed:", error);
      return compressedData;
    }
  }

  /**
   * Data optimization for storage efficiency
   */
  static optimizeForStorage(data, options = {}) {
    const {
      removeNulls = true,
      trimStrings = true,
      roundNumbers = true,
      maxArrayLength = null,
      maxObjectDepth = null,
    } = options;

    try {
      return this.optimizeObject(data, {
        removeNulls,
        trimStrings,
        roundNumbers,
        maxArrayLength,
        maxObjectDepth,
        currentDepth: 0,
      });
    } catch (error) {
      console.warn("Data optimization failed:", error);
      return data;
    }
  }

  /**
   * Recursive object optimization
   */
  static optimizeObject(obj, options) {
    if (options.currentDepth >= (options.maxObjectDepth || Infinity)) {
      return obj;
    }

    if (Array.isArray(obj)) {
      let optimized = obj.map((item) =>
        this.optimizeValue(item, {
          ...options,
          currentDepth: options.currentDepth + 1,
        })
      );

      if (options.maxArrayLength && optimized.length > options.maxArrayLength) {
        optimized = optimized.slice(0, options.maxArrayLength);
      }

      return optimized;
    }

    if (typeof obj === "object" && obj !== null) {
      const optimized = {};

      for (const [key, value] of Object.entries(obj)) {
        // Skip null values if requested
        if (options.removeNulls && value === null) {
          continue;
        }

        const optimizedValue = this.optimizeValue(value, {
          ...options,
          currentDepth: options.currentDepth + 1,
        });

        optimized[key] = optimizedValue;
      }

      return optimized;
    }

    return this.optimizeValue(obj, options);
  }

  /**
   * Optimize individual values
   */
  static optimizeValue(value, options) {
    if (typeof value === "string" && options.trimStrings) {
      return value.trim();
    }

    if (typeof value === "number" && options.roundNumbers) {
      // Round to 2 decimal places for floating point numbers
      return Math.round(value * 100) / 100;
    }

    if (typeof value === "object" && value !== null) {
      return this.optimizeObject(value, options);
    }

    return value;
  }

  /**
   * Estimate compression savings
   */
  static estimateCompressionSavings(data) {
    const original = JSON.stringify(data);
    const originalSize = new Blob([original]).size;

    // Test different compression methods
    const results = {};

    // JSON minify test
    const minified = this.jsonMinify(original);
    const minifiedSize = new Blob([minified]).size;
    results.jsonMinify = {
      originalSize,
      compressedSize: minifiedSize,
      savings: originalSize - minifiedSize,
      ratio: minifiedSize / originalSize,
    };

    // Simple compression test
    const simpleCompressed = this.simpleCompress(original);
    const simpleCompressedSize = new Blob([simpleCompressed]).size;
    results.simpleCompress = {
      originalSize,
      compressedSize: simpleCompressedSize,
      savings: originalSize - simpleCompressedSize,
      ratio: simpleCompressedSize / originalSize,
    };

    // Optimization test
    const optimized = this.optimizeForStorage(data);
    const optimizedString = JSON.stringify(optimized);
    const optimizedSize = new Blob([optimizedString]).size;
    results.optimize = {
      originalSize,
      compressedSize: optimizedSize,
      savings: originalSize - optimizedSize,
      ratio: optimizedSize / originalSize,
    };

    return results;
  }

  /**
   * Chunk large data for Chrome Storage item limits
   */
  static chunkData(data, maxChunkSize = 8000) {
    // 8KB chunks (safe margin from 8KB limit)
    const serialized = JSON.stringify(data);
    const chunks = [];

    for (let i = 0; i < serialized.length; i += maxChunkSize) {
      chunks.push(serialized.substring(i, i + maxChunkSize));
    }

    return {
      chunks,
      totalChunks: chunks.length,
      originalSize: serialized.length,
      metadata: {
        chunked: true,
        totalChunks: chunks.length,
        originalSize: serialized.length,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Reassemble chunked data
   */
  static assembleChunks(chunks, metadata) {
    try {
      if (!metadata.chunked) {
        return {
          data: JSON.parse(chunks[0]),
          success: true,
        };
      }

      const reassembled = chunks.join("");

      // Verify size matches
      if (reassembled.length !== metadata.originalSize) {
        throw new Error("Chunk assembly size mismatch");
      }

      return {
        data: JSON.parse(reassembled),
        success: true,
      };
    } catch (error) {
      console.error("Chunk assembly failed:", error);
      return {
        data: null,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Smart storage wrapper that handles compression and chunking automatically
   */
  static async prepareForChromeStorage(key, data, options = {}) {
    const {
      forceCompression = false,
      maxItemSize = 8000,
      optimize = true,
    } = options;

    try {
      // Step 1: Optimize data if requested
      let processedData = optimize ? this.optimizeForStorage(data) : data;

      // Step 2: Compress data
      const compressionResult = this.compressData(
        processedData,
        forceCompression
      );

      // Step 3: Check if chunking is needed
      const dataSize = new Blob([compressionResult.data]).size;

      if (dataSize <= maxItemSize) {
        // Data fits in single item
        return {
          items: {
            [key]: compressionResult.data,
            [`${key}_metadata`]: compressionResult.metadata,
          },
          success: true,
        };
      } else {
        // Need to chunk the data
        const chunkResult = this.chunkData(compressionResult.data, maxItemSize);
        const items = {};

        // Store chunks
        chunkResult.chunks.forEach((chunk, index) => {
          items[`${key}_chunk_${index}`] = chunk;
        });

        // Store combined metadata
        items[`${key}_metadata`] = {
          ...compressionResult.metadata,
          ...chunkResult.metadata,
        };

        return {
          items,
          success: true,
        };
      }
    } catch (error) {
      console.error("Chrome Storage preparation failed:", error);
      return {
        items: null,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Retrieve and reconstruct data from Chrome Storage
   */
  static async retrieveFromChromeStorage(key, chromeStorageData) {
    try {
      const metadata = chromeStorageData[`${key}_metadata`];

      if (!metadata) {
        throw new Error("Missing metadata for stored data");
      }

      let compressedData;

      if (metadata.chunked) {
        // Reassemble chunks
        const chunks = [];
        for (let i = 0; i < metadata.totalChunks; i++) {
          const chunk = chromeStorageData[`${key}_chunk_${i}`];
          if (!chunk) {
            throw new Error(`Missing chunk ${i} of ${metadata.totalChunks}`);
          }
          chunks.push(chunk);
        }

        const assemblyResult = this.assembleChunks(chunks, metadata);
        if (!assemblyResult.success) {
          throw new Error(assemblyResult.error);
        }
        compressedData = JSON.stringify(assemblyResult.data);
      } else {
        // Single item
        compressedData = chromeStorageData[key];
      }

      // Decompress data
      const decompressionResult = this.decompressData(compressedData, metadata);

      if (!decompressionResult.success) {
        throw new Error(decompressionResult.error);
      }

      return {
        data: decompressionResult.data,
        metadata,
        success: true,
      };
    } catch (error) {
      console.error("Chrome Storage retrieval failed:", error);
      return {
        data: null,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get compression statistics
   */
  static getCompressionStats(data) {
    const original = JSON.stringify(data);
    const originalSize = new Blob([original]).size;

    return {
      originalSize,
      recommendedMethod: this.selectCompressionType(originalSize),
      estimatedSavings: this.estimateCompressionSavings(data),
      canFitInChromeStorage: originalSize <= 8000, // Single item limit
      wouldNeedChunking: originalSize > 8000,
    };
  }
}

export default StorageCompression;
