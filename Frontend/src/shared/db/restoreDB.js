import { backupDB } from "./backupDB.js";
import { openBackupDB } from "./backupDB.js";



export async function getBackupFile() {
  const db = await dbHelper.openDB();
  const transaction = db.transaction(["backup_storage"], "readonly");
  const backupStore = transaction.objectStore("backup_storage");

  return new Promise((resolve, reject) => {
    const request = backupStore.get("latestBackup");
    request.onsuccess = () => {
      if (request.result?.data) {
        console.log("✅ Backup retrieved successfully.");
        resolve(request.result.data);
      } else {
        console.error("❌ No backup data found.");
        reject(new Error("No backup found."));
      }
    };
    request.onerror = () => reject(request.error);
  });
}


/**
 * Restores IndexedDB from a backup JSON file.
 * @param {File} file - The JSON file containing the backup.
 * @returns {Promise<void>}
 */
export async function restoreIndexedDB(file) {
  try {
    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      const backupData = JSON.parse(event.target.result);

      const request = indexedDB.open(backupData.dbName, backupData.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Recreate stores and indexes
        for (const [storeName, storeData] of Object.entries(
          backupData.stores
        )) {
          let store;

          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, {
              keyPath: storeData.metadata.keyPath,
            });
          } else {
            store = event.target.transaction.objectStore(storeName);
          }

          // Recreate indexes
          storeData.metadata.indexes.forEach((index) => {
            if (!store.indexNames.contains(index.name)) {
              store.createIndex(index.name, index.keyPath, {
                unique: index.unique,
              });
            }
          });
        }
      };

      request.onsuccess = async (event) => {
        const db = event.target.result;
        const transaction = db.transaction(
          Object.keys(backupData.stores),
          "readwrite"
        );

        await Promise.all(
          Object.entries(backupData.stores).map(
            async ([storeName, storeData]) => {
              const store = transaction.objectStore(storeName);

              // Clear existing data
              await clearStore(store);

              // Restore data
              for (const item of storeData.data) {
                store.put(item);
              }
            }
          )
        );

        console.log("Database restoration completed with indexes.");
      };

      request.onerror = (event) => {
        console.error(
          "Error opening IndexedDB during restore:",
          event.target.error
        );
      };
    };

    fileReader.readAsText(file);
  } catch (error) {
    console.error("Error during IndexedDB restore:", error);
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
