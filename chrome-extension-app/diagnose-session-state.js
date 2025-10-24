/**
 * Diagnostic script to check session state and session analytics
 */

// This would be run in the browser console to check database state
console.log('🔍 DIAGNOSTIC: Session State and Analytics Check');

// Function to check IndexedDB
async function checkDatabaseState() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CodeMasterDB', 22);

    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log('✅ Database opened successfully');

      // Check session_state
      const sessionStateTransaction = db.transaction(['session_state'], 'readonly');
      const sessionStateStore = sessionStateTransaction.objectStore('session_state');

      sessionStateStore.get('session_state').onsuccess = (event) => {
        const sessionState = event.target.result;
        console.log('📊 Session State:', sessionState);
      };

      // Check sessions
      const sessionsTransaction = db.transaction(['sessions'], 'readonly');
      const sessionsStore = sessionsTransaction.objectStore('sessions');

      sessionsStore.getAll().onsuccess = (event) => {
        const sessions = event.target.result;
        console.log('📋 All Sessions:', {
          total: sessions.length,
          completed: sessions.filter(s => s.status === 'completed').length,
          inProgress: sessions.filter(s => s.status === 'in_progress').length,
          draft: sessions.filter(s => s.status === 'draft').length,
          sessions: sessions.map(s => ({
            id: s.id?.substring(0, 8) + '...',
            status: s.status,
            attempts: s.attempts?.length || 0,
            problems: s.problems?.length || 0,
            created: s.created_date,
            lastActivity: s.last_activity_time
          }))
        });
      };

      // Check session_analytics
      const analyticsTransaction = db.transaction(['session_analytics'], 'readonly');
      const analyticsStore = analyticsTransaction.objectStore('session_analytics');

      analyticsStore.getAll().onsuccess = (event) => {
        const analytics = event.target.result;
        console.log('📈 Session Analytics:', {
          total: analytics.length,
          analytics: analytics.map(a => ({
            session_id: a.session_id?.substring(0, 8) + '...',
            completed_at: a.completed_at,
            accuracy: a.accuracy,
            totalProblems: a.totalProblems
          }))
        });
      };

      resolve(db);
    };

    request.onerror = (event) => {
      console.error('❌ Database open failed:', event);
      reject(event);
    };
  });
}

// Function to manually trigger session completion check
async function manualSessionCompletionCheck() {
  console.log('🔍 Running manual session completion check...');

  try {
    // This would need to be run in the extension context
    // where SessionService is available
    if (typeof SessionService !== 'undefined') {
      const sessions = await SessionService.getAllSessionsFromDB();
      const inProgressSessions = sessions.filter(s => s.status === 'in_progress');

      console.log('📋 In Progress Sessions:', inProgressSessions.length);

      for (const session of inProgressSessions) {
        console.log(`🔍 Checking session ${session.id}...`);
        try {
          const result = await SessionService.checkAndCompleteSession(session.id);
          console.log(`✅ Session ${session.id} result:`, result);
        } catch (error) {
          console.error(`❌ Session ${session.id} check failed:`, error);
        }
      }
    } else {
      console.log('⚠️ SessionService not available - run this in extension context');
    }
  } catch (error) {
    console.error('❌ Manual session completion check failed:', error);
  }
}

// Run diagnostics
console.log('🚀 Starting diagnostics...');
checkDatabaseState().then(() => {
  console.log('✅ Database state check completed');
}).catch(error => {
  console.error('❌ Database state check failed:', error);
});

console.log('🔍 To run manual session completion check, call: manualSessionCompletionCheck()');