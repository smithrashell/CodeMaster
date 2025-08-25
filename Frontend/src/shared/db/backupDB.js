import { dbHelper } from "./index.js";

/**
 * Opens the main database instead of separate backup database
 * @returns {Promise<IDBDatabase>} - The opened main IndexedDB instance.
 */
export async function openBackupDB() {
  console.log("📌 Using main database for backup operations...");
  return await dbHelper.openDB();
}

/**
 * Fetch all records from an IndexedDB store
 */
async function fetchAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      console.log(
        `✅ Fetched ${request.result.length} records from ${storeName}`
      );
      resolve(request.result);
    };
    request.onerror = (event) => {
      console.error(
        `❌ Error fetching data from ${storeName}:`,
        event.target.error
      );
      reject(event.target.error);
    };
  });
}

/**
 * Saves the backup data to IndexedDB `backup_storage`
 */

async function saveBackupToIndexedDB(backupData) {
  try {
    console.log("📌 Saving backup to main database backup_storage store...");
    const db = await dbHelper.openDB();
    const transaction = db.transaction(["backup_storage"], "readwrite");
    const backupStore = transaction.objectStore("backup_storage");

    await new Promise((resolve, reject) => {
      const request = backupStore.put({
        backupId: "latestBackup", // Use backupId to match main database schema
        timestamp: new Date().toISOString(),
        data: backupData,
      });
      request.onsuccess = () => {
        console.log("✅ Backup saved successfully to main database.");
        resolve();
      };
      request.onerror = () => {
        console.error("❌ Error saving backup:", request.error);
        reject(request.error);
      };
    });

    // 🔹 **Immediately Read Back & Log**
    console.log("📌 Verifying backup after save...");
    const verifyTransaction = db.transaction(
      ["backup_storage"],
      "readonly"
    );
    const verifyStore = verifyTransaction.objectStore("backup_storage");

    const verifyRequest = verifyStore.get("latestBackup");
    verifyRequest.onsuccess = (event) => {
      console.log("✅ Verified Backup Contents:", event.target.result);
    };
    verifyRequest.onerror = () => {
      console.error("❌ Error verifying backup:", verifyRequest.error);
    };
  } catch (error) {
    console.error("❌ Error saving backup to main database:", error);
    throw error;
  }
}

/**
 * Creates a backup of all IndexedDB stores and saves it in `backup_storage`
 */
export async function backupIndexedDB() {
  try {
    console.log("📌 backupIndexedDB() function STARTED.");

    const db = await dbHelper.openDB();
    if (!db) {
      console.error("❌ Failed to open IndexedDB.");
      return;
    }

    const storeNames = Array.from(db.objectStoreNames);
    console.log("✅ Store names detected:", storeNames);

    if (storeNames.length === 0) {
      console.error("❌ No stores found in IndexedDB.");
      return;
    }

    const dbBackup = {
      dbName: db.name,
      version: db.version,
      timestamp: new Date().toISOString(),
      stores: {},
    };

    // Fetch all records from each store
    for (const storeName of storeNames) {
      console.log(`📌 Fetching data from store: ${storeName}`);
      const records = await fetchAllFromStore(db, storeName);
      console.log(`✅ Retrieved ${records.length} records from ${storeName}`);
      dbBackup.stores[storeName] = { data: records };
    }

    console.log("📌 Saving backup to IndexedDB...");
    await saveBackupToIndexedDB(dbBackup);
    console.log("✅ Backup successfully stored in 'backup_storage'.");

    return { message: "✅ Backup successful." };
  } catch (error) {
    console.error("❌ Error during IndexedDB backup:", error);
    throw error;
  }
}

/**
 * Retrieves the latest backup from IndexedDB.
 * @returns {Promise<Object>} - Backup data if found.
 */
export async function getBackupFile() {
  try {
    console.log("📌 Retrieving backup from main database...");

    const db = await dbHelper.openDB();
    const transaction = db.transaction(["backup_storage"], "readonly");
    const store = transaction.objectStore("backup_storage");

    return new Promise((resolve, reject) => {
      const request = store.get("latestBackup");

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (!result) {
          console.warn("❌ No backup found in main database backup_storage store.");
          resolve(null); // Prevent errors from propagating
        } else {
          console.log("✅ Retrieved backup from main database:", result);
          resolve(result.data);
        }
      };

      request.onerror = (event) => {
        console.error("❌ Error retrieving backup from main database:", event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("❌ Error retrieving backup:", error);
    throw error;
  }
}
