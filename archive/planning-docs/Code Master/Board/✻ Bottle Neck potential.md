
  The user is asking for suggestions on escape mechanisms 
  to prevent users from getting stuck on a tag while 
  maintaining the 80% mastery threshold. I provided 
  several options:

  1. Session-based escape hatch (after 10+ sessions)
  2. Attempt-based escape hatch (after 15+ attempts)
  3. Time-based escape hatch (after 2+ weeks)
  4. Difficulty-adjusted threshold (based on global 
  success rates)

  I think the session-based or attempt-based approaches        
  are the most practical, as they're based on actual user      
  effort rather than just time passing. The user might         
  prefer one of these approaches.

> Is there anywhere else we could be causing a bottlenecks
   where we could potentaily loose user becuase they are 
  stalling and not seeing growth .  Please check the logic
   we recently defined you can use changelog as a guide .

● Great question! Let me analyze the recent logic changes
  for potential bottlenecks that could cause user
  stalling. Looking at the changelog and recent changes:

● Update Todos
  ⎿  ☐ Analyze difficulty progression bottlenecks  
     ☐ Check tag progression bottlenecks
     ☐ Review session length adaptation bottlenecks
     ☐ Examine problem selection bottlenecks

● Read(Frontend\src\shared\db\sessions.js)
  ⎿  Read 10 lines (ctrl+r to expand)

● Search(pattern: "accuracy.*0\.9", output_mode:
        "content")
  ⎿  Found 18 lines (ctrl+r to expand)

● Read(Frontend\src\shared\services\tagServices.js)
  ⎿  Read 30 lines (ctrl+r to expand)

● Based on my analysis of the recent changes, here are the
   potential bottlenecks that could cause user stalling:

  🚫 Identified Bottlenecks

  1. Difficulty Progression Bottleneck 🎯

  // 90% accuracy required for ALL difficulty upgrades
  if (accuracy >= 0.9 && sessionState.currentDifficultyCap
   === "Easy") {
    sessionState.currentDifficultyCap = "Medium";
  }
  Risk: Users stuck on Easy problems forever if they can't     
   hit 90% accuracy

  2. Tag Graduation Bottleneck 🎓

  // 80% mastery required for tag graduation
  tag.successfulAttempts / tag.totalAttempts >= 0.8
  Risk: Users stuck on same tags for weeks if they plateau     
   at 75-79%

  3. Tag Expansion Bottleneck 📈

  // 75% accuracy AND 60% efficiency required for tag
  expansion
  const canExpandToNext = accuracy >= 0.75 &&
  efficiencyScore >= 0.6;
  Risk: Users stuck working on single tag if they're
  accurate but slow

  4. Tier Progression Bottleneck 🏆

  // 80% of tier tags must be mastered
  const masteryThreshold = Math.ceil(tierTags.length *
  0.8);
  Risk: Users stuck in same tier for months

  💡 Recommended Solutions

  1. Difficulty: Add session-based escape (10+ sessions →      
  lower threshold)
  2. Tag Graduation: Add attempt-based escape (15+
  attempts → lower threshold)
  3. Tag Expansion: Separate accuracy/efficiency
  requirements
  4. Tier Progression: Add time-based escape (30+ days →       
  lower threshold)

  Which bottleneck concerns you most for user retention?       

● Update Todos
  ⎿  ☒ Analyze difficulty progression bottlenecks  
     ☒ Check tag progression bottlenecks
     ☒ Review session length adaptation bottlenecks
     ☒ Examine problem selection bottlenecks



Problem

fetchProblemsForSession() currently has 5+ distinct responsibilities and is difficult to test or extend:

    Pulls settings
    Computes adaptive values
    Fetches review problems
    Fetches new problems
    Deduplicates + pads session
    Logs and returns session

This makes reasoning about the logic harder and prevents reusability in other flows (e.g. onboarding, review-only mode).
Proposed Refactor

Break into 3 distinct layers:

    createSession() → High-level coordinator

    buildAdaptiveSessionSettings() → Handles adaptive sizing & difficulty logic

    fetchAndAssembleSessionProblems() → Handles fetching review + new problems, deduping, padding

Add: summarizeSessionPerformance(session)

New function to:

    Track tag performance deltas
    Update mastery / session state
    Log session metrics

This will enable performance dashboards and session analysis without bloating the core fetch logic.