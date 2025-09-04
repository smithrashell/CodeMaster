# IndexedDB Retry Mechanisms Usage Examples

This document provides examples of how to use the new IndexedDB retry mechanisms in the CodeMaster application.

## Basic Usage

### Using Retry-Enabled Database Functions

```javascript
// Instead of the regular function:
import { getProblem } from "../db/problems.js";

// Use the retry-enabled version:
import { getProblemWithRetry } from "../db/problems.js";

// Basic usage
try {
  const problem = await getProblemWithRetry(123);
  console.log("Problem loaded:", problem);
} catch (error) {
  console.error("Failed to load problem after retries:", error);
}

// With custom options
try {
  const problem = await getProblemWithRetry(123, {
    timeout: 3000, // 3 second timeout
    priority: "high", // High priority (faster retries)
    operationName: "loadUserProblem",
  });
} catch (error) {
  console.error("Failed to load problem:", error);
}
```

### Using Retry-Enabled Service Methods

```javascript
import { ProblemService } from "../services/problemService.js";

// Get all problems with retry logic and progress tracking
try {
  const problems = await ProblemService.getAllProblemsWithRetry({
    streaming: true,
    onProgress: (count) => {
      console.log(`Loaded ${count} problems...`);
    },
  });

  console.log(`Successfully loaded ${problems.length} problems`);
} catch (error) {
  console.error("Failed to load problems:", error);
}
```

## Advanced Usage with Cancellation

```javascript
import { ProblemService } from "../services/problemService.js";

// Create abort controller for cancellation
const abortController = ProblemService.createAbortController();

// Cancel after 10 seconds
setTimeout(() => {
  abortController.abort();
}, 10000);

try {
  const sessionProblems = await ProblemService.generateSessionWithRetry(
    {
      sessionLength: 10,
      difficulty: "Medium",
      streaming: true,
      onProgress: ({ stage, count }) => {
        console.log(`Session generation: ${stage} - ${count} processed`);
      },
    },
    abortController
  );

  console.log("Session generated successfully");
} catch (error) {
  if (error.message.includes("cancelled")) {
    console.log("Session generation was cancelled");
  } else {
    console.error("Session generation failed:", error);
  }
}
```

## Using Direct Database Helper Methods

```javascript
import { dbHelper } from "../db/index.js";

// Get a single record with retry
try {
  const problem = await dbHelper.getRecord("problems", 123, {
    timeout: 2000,
    priority: "high",
  });
} catch (error) {
  console.error("Failed to get record:", error);
}

// Execute complex transaction with retry
try {
  const result = await dbHelper.executeTransaction(
    ["problems", "attempts"],
    "readwrite",
    async (tx, [problemStore, attemptStore]) => {
      // Your transaction logic here
      const problem = await new Promise((resolve, reject) => {
        const req = problemStore.get(123);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      // Add attempt record
      await new Promise((resolve, reject) => {
        const req = attemptStore.add({
          problemId: 123,
          timestamp: Date.now(),
          success: true,
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      return { problem, attemptAdded: true };
    },
    {
      timeout: 5000,
      operationName: "addProblemAttempt",
    }
  );

  console.log("Transaction completed:", result);
} catch (error) {
  console.error("Transaction failed:", error);
}
```

## UI Integration with React Components

```jsx
import React, { useState } from "react";
import {
  RetryIndicator,
  useRetryOperation,
} from "../components/RetryIndicator/RetryIndicator.jsx";
import { ProblemService } from "../services/problemService.js";

function ProblemLoader() {
  const [problems, setProblems] = useState([]);
  const {
    isActive,
    operation,
    startOperation,
    updateOperation,
    finishOperation,
    cancelOperation,
  } = useRetryOperation("Loading Problems");

  const loadProblems = async () => {
    const abortController = startOperation({
      maxAttempts: 5,
      stage: "initializing",
    });

    try {
      updateOperation({ stage: "loading" });

      const loadedProblems = await ProblemService.getAllProblemsWithRetry({
        abortController,
        streaming: true,
        onProgress: (count) => {
          updateOperation({
            stage: "loading",
            progress: { percentage: Math.min((count / 100) * 100, 100) },
          });
        },
      });

      setProblems(loadedProblems);
      finishOperation(true);
    } catch (error) {
      finishOperation(false, error);
    }
  };

  return (
    <div>
      <button onClick={loadProblems} disabled={isActive}>
        Load Problems
      </button>

      <RetryIndicator
        isActive={isActive}
        operation={operation}
        onCancel={cancelOperation}
      />

      {problems.length > 0 && (
        <div>
          <h3>Loaded {problems.length} problems</h3>
          {/* Render problems */}
        </div>
      )}
    </div>
  );
}
```

## Performance Monitoring

```javascript
import {
  retryPerformanceMonitor,
  withRetryMonitoring,
} from "../utils/RetryPerformanceMonitor.js";

// Monitor a function automatically
const monitoredFunction = withRetryMonitoring(
  "myDatabaseOperation",
  async (data) => {
    // Your database operation here
    return await someComplexDatabaseOperation(data);
  }
);

// Manual monitoring
async function complexOperation() {
  const context = retryPerformanceMonitor.startOperation("complexOperation");

  try {
    const result = await performOperation();
    retryPerformanceMonitor.endOperation(context, result);
    return result;
  } catch (error) {
    retryPerformanceMonitor.endOperation(context, null, error);
    throw error;
  }
}

// Get performance statistics
const stats = retryPerformanceMonitor.getPerformanceStats();
console.log("Retry performance stats:", stats);

// Get recommendations
const recommendations = retryPerformanceMonitor.getRecommendations();
console.log("Performance recommendations:", recommendations);

// Generate comprehensive report
const report = retryPerformanceMonitor.generateReport();
console.log("Performance report:", report);
```

## Status Monitoring

```jsx
import React from "react";
import { RetryStatusBadge } from "../components/RetryIndicator/RetryIndicator.jsx";
import indexedDBRetry from "../services/IndexedDBRetryService.js";

function StatusBar() {
  return (
    <div className="status-bar">
      <RetryStatusBadge
        onClick={() => {
          const stats = indexedDBRetry.getStatistics();
          console.log("Database retry status:", stats);
        }}
      />
    </div>
  );
}
```

## Error Handling Patterns

```javascript
import { checkDatabaseForProblemWithRetry } from "../db/problems.js";

async function safeCheckProblem(problemId) {
  try {
    return await checkDatabaseForProblemWithRetry(problemId, {
      timeout: 2000,
      priority: "high",
    });
  } catch (error) {
    // Check if it's a non-retryable error
    if (error.message.includes("Quota exceeded")) {
      // Handle quota exceeded specifically
      console.warn("Database quota exceeded, using fallback");
      return false; // Assume problem doesn't exist
    }

    // Check if circuit breaker is open
    if (error.message.includes("Circuit breaker is open")) {
      console.warn("Database temporarily unavailable");
      return null; // Return null to indicate unknown state
    }

    // For other errors, propagate them
    throw error;
  }
}
```

## Configuration

```javascript
import indexedDBRetry from "../services/IndexedDBRetryService.js";

// Get current configuration
const stats = indexedDBRetry.getStatistics();
console.log("Current timeout settings:", stats.config);

// Monitor network status
indexedDBRetry.addNetworkListener((isOnline) => {
  if (isOnline) {
    console.log("Network reconnected");
  } else {
    console.log("Network offline");
  }
});

// Check circuit breaker status
const circuitBreakerStatus = indexedDBRetry.getCircuitBreakerStatus();
if (!circuitBreakerStatus.isHealthy) {
  console.warn("Database operations may be unreliable");
}
```

## Best Practices

1. **Use appropriate timeouts**: Quick operations (1s), normal operations (5s), bulk operations (15s)

2. **Set correct priority**: 'high' for user-initiated actions, 'normal' for background operations, 'low' for maintenance tasks

3. **Provide user feedback**: Use RetryIndicator component for long-running operations

4. **Handle cancellation**: Provide abort controllers for operations that users might want to cancel

5. **Monitor performance**: Use RetryPerformanceMonitor to track and optimize retry behavior

6. **Graceful degradation**: Handle non-retryable errors appropriately and provide fallback behavior

7. **Use deduplication**: Set deduplicationKey for operations that might be called multiple times concurrently

8. **Network awareness**: Check network status before starting operations that require connectivity
