import { dbHelper } from "./index.js";
import { openBackupDB, getBackupFile as getBackupFileFromBackupDB } from "./backupDB.js";

export async function getBackupFile() {
  // Use the backup function from backupDB.js to maintain consistency
  return await getBackupFileFromBackupDB();
}

/**
 * Restores IndexedDB from a backup JSON file using the centralized database.
 * @param {File} file - The JSON file containing the backup.
 * @returns {Promise<void>}
 */
export async function restoreIndexedDB(file) {
  try {
    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      const backupData = JSON.parse(event.target.result);
      
      console.log("📌 Starting database restoration from backup...");
      
      // Use the centralized database approach
      const db = await dbHelper.openDB();
      
      // Get list of stores that exist in both backup and current database
      const storesToRestore = Object.keys(backupData.stores).filter(
        storeName => db.objectStoreNames.contains(storeName)
      );
      
      console.log(`📌 Restoring ${storesToRestore.length} stores: ${storesToRestore.join(', ')}`);
      
      if (storesToRestore.length === 0) {
        console.warn("❌ No compatible stores found to restore");
        return;
      }

      const transaction = db.transaction(storesToRestore, "readwrite");

      await Promise.all(
        storesToRestore.map(async (storeName) => {
          const store = transaction.objectStore(storeName);
          const storeData = backupData.stores[storeName];

          // Clear existing data
          await clearStore(store);

          // Restore data
          console.log(`📌 Restoring ${storeData.data.length} records to ${storeName}`);
          for (const item of storeData.data) {
            store.put(item);
          }
        })
      );

      console.log("✅ Database restoration completed using centralized database.");
    };

    fileReader.readAsText(file);
  } catch (error) {
    console.error("❌ Error during IndexedDB restore:", error);
    throw error;
  }
}

/**
 * Clears all data from an IndexedDB store.
 * @param {IDBObjectStore} store - The IndexedDB store.
 * @returns {Promise<void>}
 */
function clearStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
