
async function checkSession() {
  const dbRequest = indexedDB.open('CodeMaster', 47);
  
  dbRequest.onsuccess = (event) => {
    const db = event.target.result;
    const tx = db.transaction(['sessions', 'attempts'], 'readonly');
    const sessionStore = tx.objectStore('sessions');
    const attemptStore = tx.objectStore('attempts');
    
    // Get the problematic session
    const sessionReq = sessionStore.get('3e2dbbf3-900d-48eb-b21b-817d29c496c0');
    sessionReq.onsuccess = () => {
      const session = sessionReq.result;
      console.log('Session problems (leetcode_ids):', session.problems.map(p => p.leetcode_id));
      console.log('Session attempts (leetcode_ids):', session.attempts.map(a => a.leetcode_id));
      
      // Check if 1772 is in the session
      const has1772 = session.problems.some(p => p.leetcode_id === 1772);
      console.log('Session has problem 1772?', has1772);
      
      // Get the problematic attempt
      const attemptReq = attemptStore.get('54ddce64-15e0-48ff-b110-a9eabee435e4');
      attemptReq.onsuccess = () => {
        const attempt = attemptReq.result;
        console.log('Problematic attempt:', {
          id: attempt.id,
          leetcode_id: attempt.leetcode_id,
          session_id: attempt.session_id,
          success: attempt.success
        });
      };
    };
  };
}

checkSession();

