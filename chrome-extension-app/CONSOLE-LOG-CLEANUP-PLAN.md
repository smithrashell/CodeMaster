# Console.log Cleanup Plan

## Analysis Summary
Total console.log/debug/info/warn/error: **1,467 occurrences** across 138 files

## Categorization

### Category 1: REMOVE - Pure Debug Logging (Est. ~60%)
These should be completely removed:
- `🚀 DEBUG:` prefixed logs
- `🔍 DATABASE DEBUG:` logs
- `📍` navigation debug logs
- Render/mount lifecycle logs (`🏗️ DEBUG:`, `🗑️ DEBUG:`)
- Generic `console.log("data:", data)` debugging

**Files with heavy debug logging:**
- `src/shared/db/accessControl.js` - 15+ debug logs
- `src/background/core-business-tests.js` - 75+ test logs
- `src/shared/provider/*` - Lifecycle debug logs
- `src/content/content.jsx` - Startup debug logs

### Category 2: CONVERT - Useful Operational Logs (Est. ~30%)
Convert to logger with appropriate levels:
- Error handling: `console.error()` → `logger.error()`
- Warnings: `console.warn()` → `logger.warn()`
- Important state changes → `logger.info()`
- Test initialization/results → Keep but wrap in test mode check

**Examples:**
```javascript
// Before:
console.error("Failed to get problem count by box level");

// After:
logger.error("Failed to get problem count by box level", { context: "ProblemStats" });
```

### Category 3: KEEP - Critical Production Logs (Est. ~10%)
Keep as-is (mostly errors):
- Chrome extension errors (runtime.lastError)
- Critical failure scenarios
- User-facing error reporting

## Implementation Strategy

### Phase 1: Configure Webpack (Priority 1)
Add terser plugin to strip console.* in production builds

### Phase 2: High-Impact Files (Priority 2)
Clean files with most console.logs:
1. `src/background/core-business-tests.js` (75+ logs) - Wrap in test mode
2. `src/shared/db/accessControl.js` (15+ logs) - Remove debug, keep errors
3. `src/content/services/strategyService.js` - Remove hint debugging
4. `src/shared/db/sessionAnalytics.js` - Remove storage debugging
5. `src/shared/db/sessions.js` - Remove index debugging

### Phase 3: Provider/Lifecycle Cleanup (Priority 3)
Remove render/mount lifecycle logs:
- `src/shared/provider/appprovider.jsx`
- `src/shared/provider/navprovider.jsx`
- `src/shared/provider/PreviousRouteProvider.js`
- `src/content/content.jsx`

### Phase 4: Services & Components (Priority 4)
Systematically clean remaining files

## Automated Cleanup Patterns

### Pattern 1: Remove Debug Logs
```bash
# Remove lines with DEBUG prefix
sed -i '/console\.log.*DEBUG:/d' file.js
```

### Pattern 2: Convert Error Logs
```bash
# Replace console.error with logger.error
sed -i 's/console\.error(/logger.error(/g' file.js
```

### Pattern 3: Remove Lifecycle Logs
```bash
# Remove RENDER/MOUNTED/UNMOUNTED logs
sed -i '/console\.log.*RENDER\|MOUNTED\|UNMOUNTED/d' file.js
```

## Testing Checklist
- [ ] Verify logger imports added where needed
- [ ] Test production build completes without console logs
- [ ] Test error handling still works
- [ ] Verify no missing critical logs
- [ ] Check bundle size reduction

## Expected Outcomes
- Remove ~900 unnecessary debug logs
- Convert ~440 logs to logger system
- Keep ~127 critical logs
- Reduce bundle size by ~50-100KB
- Improve runtime performance (no console overhead)
