# ESLint Violation Fixing Process

## Current Status (as of 2025-10-08)

**Progress:** 60 → 18 warnings (70% reduction)
**Tests:** All 383 tests passing ✅
**Branch:** `fix/linting-remaining-issues`
**Worktree:** `CodeMaster-linting-v2`

## Completed Batches

### Batches 1-18 (Previous Session)
- **Result:** 60 → 20 warnings (67% reduction)
- **Fixes:** 37 max-lines-per-function violations
- **Strategy:** Extracted helper functions from large functions

### Batch 19
- **File:** `src/shared/db/sessions.js`
- **Result:** 20 warnings (no change, different violations addressed)
- **Fixes:**
  - `applyDifficultyPromotion`: 9 params → 1 context object
  - `logAdaptiveConfig`: 6 params → 1 config object
- **Commit:** `a4e9a04`

### Batch 20
- **File:** `src/shared/db/problems.js`
- **Function:** `fetchAdditionalProblems` (397 lines → 36 lines)
- **Result:** 20 → 19 warnings
- **Extracted Helpers:**
  1. `loadProblemSelectionContext`
  2. `filterProblemsByDifficultyCap`
  3. `logProblemSelectionStart`
  4. `calculateTagDifficultyAllowances`
  5. `selectPrimaryAndExpansionProblems`
  6. `addExpansionProblems`
  7. `logSelectedProblems`
  8. `expandWithRemainingFocusTags`
  9. `fillRemainingWithRandomProblems`
- **Additional Fixes:**
  - Removed unused import `getTagRelationships`
  - Fixed require-await violations
  - Fixed max-params violations using params objects
  - Removed unused `tagDifficultyAllowances` parameter
- **Commit:** `c109f53`

### Batch 21
- **File:** `src/shared/services/problemService.js`
- **Function:** `fetchAndAssembleSessionProblems` (195 lines → ~45 lines)
- **Result:** 19 → 18 warnings
- **Extracted Helpers:**
  1. `addReviewProblemsToSession`
  2. `analyzeReviewProblems`
  3. `addNewProblemsToSession`
  4. `selectNewProblems`
  5. `addFallbackProblems`
  6. `checkSafetyGuardRails`
  7. `logFinalSessionComposition`
- **Commit:** `11451a2`

## Remaining Violations (18 total)

### Production Code (Non-Test Files)
1. **sessionService.js:180** - `summarizeSessionPerformance` (266 lines, 136 over limit)
2. **dbHelperFactory.js:31** - `createDbHelper` (663 lines, 513 over limit)
3. **dbHelperFactory.js:731** - `createScenarioTestDb` (236 lines, 86 over limit)
4. **ProblemPageTimerTour.jsx:459** - `ProblemPageTimerTour` (300 lines, 170 over limit)
5. **main.jsx:341** - Arrow function (216 lines, 116 over limit)
6. **FocusAreasSelectorRenderHelpers.jsx:91** - Arrow function (312 lines, 182 over limit)

### Test Files (Lower Priority)
7. **core-business-tests.js:212** - `initializeCoreBusinessTests` (1405 lines!)
8. **core-business-tests.js:1145** - `testMasteryGates` (196 lines + complexity 26)
9. **ProblemPageTimerTour.jsx:240** - Arrow function (190 lines)
10. **ProblemPageTimerTour.jsx:245** - Arrow function (176 lines)
11. **dashboardService.critical.test.js:37** - Arrow function (477 lines)
12. **dataConsistency.infrastructure.test.js:14** - Arrow function (382 lines)
13. **errorRecovery.infrastructure.test.js:12** - Arrow function (428 lines)
14. **focusCoordinationService.test.js:17** - Arrow function (200 lines)
15. **problemService.critical.test.js:41** - Arrow function (487 lines)
16. **session.integration.test.js:36** - Arrow function (583 lines)
17. **sessionService.critical.test.js:39** - Arrow function (385 lines)

## Refactoring Process

### 1. Assessment
```bash
# Get current violations sorted by file and line count
npm run lint 2>&1 | grep "max-lines-per-function" | head -20
```

### 2. Target Selection Strategy
- **Priority 1:** Production code (non-test files)
- **Priority 2:** Smallest violations first (easier wins)
- **Skip:** Test files until production code is clean

### 3. Refactoring Pattern

#### For Each Function:
1. **Read the function** - Understand its purpose and structure
2. **Identify logical sections** - Look for:
   - Validation/setup steps
   - Data fetching/loading
   - Processing/calculation blocks
   - Logging/debug sections
   - Result formatting/return
3. **Extract helper functions** - Create focused helpers for each section
4. **Use parameter objects** - If helper has >5 params, use destructuring
5. **Remove unused code** - Fix any unused vars/imports revealed

#### Naming Conventions:
- **Verbs for actions:** `addReviewProblems`, `calculateMetrics`, `validateInput`
- **Nouns for data:** `loadSessionContext`, `createAnalyticsRecord`
- **Specific names:** Avoid generic names like `helper1`, `processData`

### 4. Testing & Verification
```bash
# After each change:
npm run lint 2>&1 | grep -E "(warning|error|✖)" | tail -20
npm test -- --passWithNoTests --silent

# Verify test count stays at 383 passing
```

### 5. Commit Pattern
```bash
git add -A
git commit -m "refactor: batch N - reduce <functionName> from X to Y lines

Extracted N helper functions:
- helperFunction1
- helperFunction2
...

Fixed violations:
- Description of any other fixes
- ...

X → Y warnings (Z fixed)
All 383 tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Common Patterns & Solutions

### Pattern 1: Long Validation Blocks
**Before:**
```javascript
function process(a, b, c, d, e, f) {
  if (!a) throw new Error("a required");
  if (!b) throw new Error("b required");
  if (c < 0) throw new Error("c invalid");
  // ... 20 more lines of validation

  // actual logic here
}
```

**After:**
```javascript
function validateInputs(params) {
  const { a, b, c } = params;
  if (!a) throw new Error("a required");
  if (!b) throw new Error("b required");
  if (c < 0) throw new Error("c invalid");
}

function process(params) {
  validateInputs(params);
  // actual logic here
}
```

### Pattern 2: Sequential Data Loading
**Before:**
```javascript
async function bigFunction() {
  const data1 = await fetch1();
  const data2 = await fetch2();
  const data3 = await fetch3();
  const data4 = transform(data1, data2);
  // ... 50 more lines
}
```

**After:**
```javascript
async function loadRequiredData() {
  const data1 = await fetch1();
  const data2 = await fetch2();
  const data3 = await fetch3();
  return { data1, data2, data3 };
}

async function bigFunction() {
  const { data1, data2, data3 } = await loadRequiredData();
  const data4 = transform(data1, data2);
  // ... remaining logic
}
```

### Pattern 3: Max-Params Violations
**Before:**
```javascript
function helper(a, b, c, d, e, f) {
  // 6 params = violation
}
```

**After:**
```javascript
function helper(params) {
  const { a, b, c, d, e, f } = params;
  // same logic
}

// Call site:
helper({ a, b, c, d, e, f });
```

### Pattern 4: Logging Blocks
**Before:**
```javascript
function process() {
  // logic here

  logger.info("Result 1:", result1);
  logger.info("Result 2:", result2);
  logger.info("Result 3:", result3);
  logger.info("Total:", total);
  logger.info("Average:", avg);
  // 15 more logging lines
}
```

**After:**
```javascript
function logResults(results) {
  logger.info("Result 1:", results.result1);
  logger.info("Result 2:", results.result2);
  logger.info("Result 3:", results.result3);
  logger.info("Total:", results.total);
  logger.info("Average:", results.avg);
}

function process() {
  // logic here
  logResults({ result1, result2, result3, total, avg });
}
```

## ESLint Rule Limits

- `max-lines-per-function`: 100, 130, or 150 depending on file
- `max-params`: 5 parameters
- `complexity`: 20 (cyclomatic complexity)
- `no-unused-vars`: Variables must match `/^_/u` if unused

## Next Steps

1. **Batch 22:** Fix `summarizeSessionPerformance` in sessionService.js (266 → <130 lines)
2. **Batch 23:** Fix `createDbHelper` in dbHelperFactory.js (663 → <150 lines)
3. **Batch 24:** Fix `createScenarioTestDb` in dbHelperFactory.js (236 → <150 lines)
4. Continue until all production code violations are resolved
5. Then tackle test file violations if needed

## Useful Commands

```bash
# Check current working directory
pwd

# List all warnings with file paths
npm run lint 2>&1 | grep -B1 "max-lines-per-function" | grep -E "\.js|\.jsx|warning"

# Count remaining warnings
npm run lint 2>&1 | grep "warning" | wc -l

# Run tests
npm test -- --passWithNoTests --silent

# Git status
git status
git log --oneline -5

# Switch to worktree
cd /c/Users/rashe/Projects/CodingProjects/CodeMaster-linting-v2/chrome-extension-app
```

## Important Notes

- **Never batch completions** - Mark tasks complete immediately after finishing
- **Always test after changes** - Ensure 383 tests still pass
- **Commit after each batch** - Don't accumulate changes
- **Use params objects** - For functions with >5 parameters
- **Prefix unused params** - Use `_paramName` for intentionally unused params
- **Remove async if no await** - Fixes require-await violations
- **Extract to top-level functions** - Not nested inside other functions (unless closure needed)
- **Maintain single responsibility** - Each helper should do one thing well

## Recovery Instructions

If starting a new session:

1. Navigate to worktree: `cd /c/Users/rashe/Projects/CodingProjects/CodeMaster-linting-v2/chrome-extension-app`
2. Check current status: `npm run lint 2>&1 | grep -E "✖"`
3. Review this document for context
4. Continue with next batch from "Remaining Violations" section
5. Follow the refactoring process for each function
