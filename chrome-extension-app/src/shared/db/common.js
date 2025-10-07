import { dbHelper } from "./index.js";
const openDB = dbHelper.openDB;

export async function getAllFromStore(storeName) {
  try {
    const db = await openDB();
    
    // Validate database connection before creating transaction
    if (!db || !db.name || !db.version) {
      throw new Error(`Database connection invalid for ${storeName}`);
    }
    
    return new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to get all records from ${storeName}: ${request.error?.message || 'Unknown error'}`));
        
        transaction.onerror = () => reject(new Error(`Transaction failed for ${storeName}: ${transaction.error?.message || 'Unknown error'}`));
        transaction.onabort = () => reject(new Error(`Transaction aborted for ${storeName}`));
        
      } catch (error) {
        reject(new Error(`Failed to create transaction for ${storeName}: ${error.message}`));
      }
    });
  } catch (error) {
    throw new Error(`Database access failed for ${storeName}: ${error.message}`);
  }
}

export async function getRecord(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addRecord(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateRecord(storeName, id, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAllToStore(storeName, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    items.forEach((item) => {
      store.put(item).onerror = (event) => {
        reject(event.target.error);
      };
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) =>
      reject(new Error(`Transaction error in ${storeName}: ${event.target.error}`));
  });
}
