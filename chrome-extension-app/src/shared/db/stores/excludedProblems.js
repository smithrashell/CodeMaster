import { dbHelper } from "../index.js";

const openDB = () => dbHelper.openDB();

/**
 * Permanently excludes a problem from future session selection.
 * @param {number} leetcodeId - The LeetCode problem ID (matches standard_problems.id)
 * @param {string} reason - Exclusion reason (e.g. 'not_relevant')
 * @returns {Promise<void>}
 */
export async function excludeProblem(leetcodeId, reason) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("excluded_problems", "readwrite");
    const store = tx.objectStore("excluded_problems");
    const request = store.put({
      leetcode_id: Number(leetcodeId),
      excluded_at: new Date().toISOString(),
      reason
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns true if the given problem has been permanently excluded.
 * @param {number} leetcodeId
 * @returns {Promise<boolean>}
 */
export async function isExcluded(leetcodeId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("excluded_problems", "readonly");
    const store = tx.objectStore("excluded_problems");
    const request = store.get(Number(leetcodeId));
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns the set of all excluded LeetCode IDs.
 * Loaded once at session assembly time for O(1) per-problem checks.
 * @returns {Promise<Set<number>>}
 */
export async function getExcludedIds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("excluded_problems", "readonly");
    const store = tx.objectStore("excluded_problems");
    const request = store.getAll();
    request.onsuccess = () => {
      const ids = new Set(request.result.map(r => r.leetcode_id));
      resolve(ids);
    };
    request.onerror = () => reject(request.error);
  });
}
