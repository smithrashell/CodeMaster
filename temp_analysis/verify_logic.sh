#!/bin/bash

echo "=== BATCH 3 REFACTORING VERIFICATION ==="
echo ""
echo "Checking for capability loss patterns..."
echo ""

# Check 1: Verify all await statements preserved
echo "## 1. Await Statement Verification"
SOURCE_AWAITS=$(grep -c "await " temp_analysis/source_version.js)
CURRENT_AWAITS=$(grep -c "await " chrome-extension-app/src/background/index.js)
echo "  Source version awaits: $SOURCE_AWAITS"
echo "  Current version awaits: $CURRENT_AWAITS"
if [ "$CURRENT_AWAITS" -lt "$SOURCE_AWAITS" ]; then
  echo "  ⚠️  WARNING: Fewer await statements detected"
else
  echo "  ✓ Await count preserved or increased"
fi
echo ""

# Check 2: Verify return statements
echo "## 2. Return Statement Verification"
SOURCE_RETURNS=$(grep -c "return " temp_analysis/source_version.js)
CURRENT_RETURNS=$(grep -c "return " chrome-extension-app/src/background/index.js)
echo "  Source version returns: $SOURCE_RETURNS"
echo "  Current version returns: $CURRENT_RETURNS"
if [ "$CURRENT_RETURNS" -lt "$SOURCE_RETURNS" ]; then
  echo "  ⚠️  WARNING: Fewer return statements"
else
  echo "  ✓ Return statements preserved"
fi
echo ""

# Check 3: Verify error handling
echo "## 3. Error Handling Verification"
SOURCE_CATCHES=$(grep -c "catch" temp_analysis/source_version.js)
CURRENT_CATCHES=$(grep -c "catch" chrome-extension-app/src/background/index.js)
echo "  Source version catch blocks: $SOURCE_CATCHES"
echo "  Current version catch blocks: $CURRENT_CATCHES"
if [ "$CURRENT_CATCHES" -lt "$SOURCE_CATCHES" ]; then
  echo "  ⚠️  WARNING: Fewer catch blocks"
else
  echo "  ✓ Error handling preserved"
fi
echo ""

# Check 4: Verify conditional branches
echo "## 4. Conditional Logic Verification"
SOURCE_IFS=$(grep -c "if (" temp_analysis/source_version.js)
CURRENT_IFS=$(grep -c "if (" chrome-extension-app/src/background/index.js)
echo "  Source version conditionals: $SOURCE_IFS"
echo "  Current version conditionals: $CURRENT_IFS"
if [ "$CURRENT_IFS" -lt "$((SOURCE_IFS - 10))" ]; then
  echo "  ⚠️  WARNING: Significantly fewer conditionals"
else
  echo "  ✓ Conditional logic preserved"
fi
echo ""

# Check 5: Look for removed function calls in the diff
echo "## 5. Function Call Analysis"
REMOVED_CALLS=$(git diff fd78eb8 chrome-extension-app/src/background/index.js | grep "^-" | grep -E "\w+\([^)]*\)" | wc -l)
ADDED_CALLS=$(git diff fd78eb8 chrome-extension-app/src/background/index.js | grep "^+" | grep -E "\w+\([^)]*\)" | wc -l)
echo "  Removed function calls: $REMOVED_CALLS"
echo "  Added function calls: $ADDED_CALLS"
if [ "$ADDED_CALLS" -ge "$REMOVED_CALLS" ]; then
  echo "  ✓ Function calls preserved or increased"
else
  echo "  ⚠️  WARNING: Net decrease in function calls"
fi
echo ""

echo "=== SUMMARY ==="
echo "Lines added: $(git diff fd78eb8 chrome-extension-app/src/background/index.js | grep -c "^+")"
echo "Lines removed: $(git diff fd78eb8 chrome-extension-app/src/background/index.js | grep -c "^-")"
echo ""
