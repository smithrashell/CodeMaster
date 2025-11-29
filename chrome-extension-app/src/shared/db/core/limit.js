import { dbHelper } from "../index.js";
const openDB = dbHelper.openDB;

export const getMostRecentLimit = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("standard_problems", "readonly");
    const store = transaction.objectStore("standard_problems");

    const request = store.get(id);
    request.onsuccess = (event) => {
      console.log(
        "✅ Successfully got the limit from standard_problems",
        event.target.result
      );
      resolve(event.target.result?.difficulty || null);
    };
    request.onerror = () => {
      console.log(
        "❌ Error getting the limit from standard_problems",
        request.error
      );
      reject(request.error);
    };
  });
};
