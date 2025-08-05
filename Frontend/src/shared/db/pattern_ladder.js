import { dbHelper } from "./index.js";
const openDB = dbHelper.openDB;

export async function clearPatternLadders() {
  const db = await openDB();
  const tx = db.transaction("pattern_ladders", "readwrite");
  const store = tx.objectStore("pattern_ladders");
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

export async function upsertPatternLadder(ladderObj) {
  const db = await openDB();
  const tx = db.transaction("pattern_ladders", "readwrite");
  tx.objectStore("pattern_ladders").put(ladderObj);
  return tx.complete;
}
