// Test script to verify the interview session staleness fix
// This simulates the classification logic with the user's actual session data

// Mock session data provided by user
const userSession = {
  "id": "024b3783-2f74-4855-adaf-5070cbb4ab7b",
  "date": "2025-08-28T22:14:41.542Z",
  "status": "draft",
  "origin": "generator",
  "startedBy": "auto_inferred",
  "lastActivityTime": "2025-08-27T22:14:41.542Z", // 24+ hours ago
  "sessionType": "interview-like",
  "attempts": [],
  "problems": [
    { "id": 268, "title": "Missing Number" },
    { "id": 2273, "title": "Find Resultant Array After Removing Anagrams" },
    { "id": 49, "title": "Group Anagrams" },
    { "id": 522, "title": "Longest Uncommon Subsequence II" }
  ]
};

// Simulate the FIXED classifySessionState logic
function classifySessionState(session) {
  const now = Date.now();
  const lastActivity = new Date(session.lastActivityTime || session.date);
  const hoursStale = (now - lastActivity.getTime()) / (1000 * 60 * 60);
  
  const attemptCount = session.attempts?.length || 0;
  const totalProblems = session.problems?.length || 0;
  const progressRatio = totalProblems > 0 ? attemptCount / totalProblems : 0;
  
  console.log(`🔍 Classifying session ${session.id.substring(0, 8)}:`, {
    sessionType: session.sessionType,
    status: session.status,
    hoursStale: Math.round(hoursStale * 10) / 10,
    attemptCount,
    totalProblems,
    progressRatio: Math.round(progressRatio * 100) / 100
  });
  
  // ✅ FIXED: Active sessions - use interview-aware thresholds
  const activeThreshold = (session.sessionType === 'interview-like' || session.sessionType === 'full-interview') ? 3 : 6;
  console.log(`📊 Active threshold for ${session.sessionType || 'standard'}: ${activeThreshold} hours`);
  
  if (hoursStale < activeThreshold || session.status === "completed") {
    console.log(`✅ Session is ACTIVE (${hoursStale.toFixed(1)}h < ${activeThreshold}h threshold)`);
    return "active";
  }
  
  console.log(`⚠️ Session is STALE (${hoursStale.toFixed(1)}h > ${activeThreshold}h threshold)`);
  
  // Interview session classification - different thresholds for time-sensitive practice
  if (session.sessionType && (session.sessionType === 'interview-like' || session.sessionType === 'full-interview')) {
    console.log(`🎯 Applying interview-specific classification...`);
    
    // Interview sessions have shorter staleness thresholds due to their time-sensitive nature
    if (hoursStale > 3) {
      if (attemptCount === 0 && hoursStale > 6) {
        console.log(`🚫 Classification: interview_abandoned (no attempts + ${hoursStale.toFixed(1)}h > 6h)`);
        return 'interview_abandoned';
      }
      console.log(`⏰ Classification: interview_stale (${hoursStale.toFixed(1)}h > 3h)`);
      return 'interview_stale';
    }
    console.log(`✅ Classification: interview_active`);
    return 'interview_active';
  }
  
  // Other classification logic would continue here...
  console.log(`❓ Classification: unclear (no specific rules matched)`);
  return 'unclear';
}

// Function to determine if banner should show (matches background script logic)
function shouldShowRegenerationBanner(classification) {
  // Background script logic: isSessionStale = !['active', 'unclear'].includes(classification);
  return !['active', 'unclear'].includes(classification);
}

// Test the fix
console.log('🧪 Testing Interview Session Staleness Fix\n');
console.log('📅 User Session Data:');
console.log(`   Created: ${userSession.date}`);
console.log(`   Last Activity: ${userSession.lastActivityTime}`);
console.log(`   Session Type: ${userSession.sessionType}`);
console.log(`   Status: ${userSession.status}`);
console.log(`   Attempts: ${userSession.attempts.length}`);
console.log('');

console.log('🔍 Running Classification Logic:');
const classification = classifySessionState(userSession);
console.log('');

console.log('📊 Results:');
console.log(`   Classification: ${classification}`);
console.log(`   Show Regeneration Banner: ${shouldShowRegenerationBanner(classification) ? '✅ YES' : '❌ NO'}`);
console.log('');

if (classification === 'interview_stale' || classification === 'interview_abandoned') {
  console.log('🎉 SUCCESS: Fix working correctly!');
  console.log('   - Interview session properly classified as stale/abandoned');
  console.log('   - Banner should now appear in UI');
  console.log('   - User can choose to regenerate or continue');
  if (classification === 'interview_abandoned') {
    console.log('   - Note: Classified as "abandoned" due to no attempts + 24+ hours');
  }
} else {
  console.log('❌ ISSUE: Fix may not be working');
  console.log(`   - Expected: interview_stale or interview_abandoned`);
  console.log(`   - Actual: ${classification}`);
}

console.log('');
console.log('🎯 Expected UI Behavior:');
console.log('   1. Interview Mode Banner (if manual frequency)');
console.log('   2. ⏰ Session Regeneration Banner');
console.log('   3. Problems List');