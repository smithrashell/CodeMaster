import { dbHelper } from "./index.js";
const openDB = dbHelper.openDB;

export async function getAllFromStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }