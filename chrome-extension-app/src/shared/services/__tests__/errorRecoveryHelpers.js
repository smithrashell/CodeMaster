/**
 * Helper functions for error recovery tests
 * Extracted to reduce line count in test files
 */

// Helper functions for Data Recovery Under Load tests
export function createMemoryPressureSimulator() {
  let operationTimes = [];

  return () => {
    const baseTime = 100; // Normal operation time
    const pressureMultiplier = operationTimes.length + 1; // Increasing pressure
    const operationTime = baseTime * Math.pow(1.5, pressureMultiplier);

    operationTimes.push(operationTime);

    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          completed: true,
          duration: operationTime,
          memoryUsage: operationTimes.length * 10 + "MB"
        });
      }, operationTime);
    });
  };
}

export function validateRollbackConsistency(result) {
  if (!result.rollbackPerformed || !result.rollbackIncomplete) return [];

  const inconsistencies = [];

  if (result.preState.attempts.length !== result.postState.attempts.length) {
    inconsistencies.push("attempts_not_restored");
  }

  if (result.preState.problemStats.totalSolved !== result.postState.problemStats.totalSolved) {
    inconsistencies.push("stats_not_restored");
  }

  if (inconsistencies.length > 0) {
    console.error("Transaction rollback incomplete:", {
      inconsistencies,
      dataIntegrityCompromised: true,
      recommendedAction: "manual_data_repair"
    });
  }

  return inconsistencies;
}

export function analyzePerformanceDegradation(results) {
  const durations = results.map(r => r.duration);
  const performanceDegradation = durations[durations.length - 1] / durations[0];

  if (performanceDegradation > 3) {
    console.warn("Memory pressure detected:", {
      performanceDegradation: performanceDegradation + "x slower",
      operationTimes: durations,
      recommendedActions: [
        "implement_operation_throttling",
        "add_memory_monitoring",
        "optimize_data_structures"
      ]
    });
  }

  return performanceDegradation;
}

// Helper functions for User Action Recovery tests
export function createMockActionProcessor() {
  let processCount = 0;
  return (action) => {
    processCount++;

    return {
      actionId: action.id,
      processed: true,
      processCount,
      newState: {
        totalSolved: 10 + processCount, // Should only increment once
        attempts: Array(processCount).fill({ problemId: 1 }) // Duplicated attempts
      },
      duplicateDetected: processCount > 1
    };
  };
}

export function createMockUserActions() {
  return [
    { type: "problem_completed", problemId: 1, timestamp: Date.now() - 3000 },
    { type: "problem_completed", problemId: 2, timestamp: Date.now() - 2000 },
    { type: "session_completed", sessionId: "session-1", timestamp: Date.now() - 1000 }
  ];
}

export function createExpectedRecoveryStates() {
  return {
    expected: {
      completedProblems: [1, 2],
      completedSessions: ["session-1"],
      totalSolved: 12 // Was 10, now 12 after 2 completions
    },
    actualAfterRecovery: {
      completedProblems: [1], // Lost problem 2 completion
      completedSessions: [], // Lost session completion
      totalSolved: 11 // Inconsistent count
    }
  };
}
