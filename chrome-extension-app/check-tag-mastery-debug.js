// Paste this into browser console to check tag mastery status
(async function() {
  const db = await indexedDB.open('CodeMasterDB');
  const tx = db.transaction(['tag_mastery', 'attempts'], 'readonly');
  const tagMastery = await new Promise(r => {
    const req = tx.objectStore('tag_mastery').getAll();
    req.onsuccess = () => r(req.result);
  });
  const attempts = await new Promise(r => {
    const req = tx.objectStore('attempts').getAll();
    req.onsuccess = () => r(req.result);
  });
  
  console.log('Tag Mastery Records:', tagMastery);
  console.log('Total attempts in DB:', attempts.length);
  console.log('Recent attempts:', attempts.slice(-5));
})();
