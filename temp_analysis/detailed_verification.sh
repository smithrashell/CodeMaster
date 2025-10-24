#!/bin/bash

echo "=== DETAILED BEHAVIORAL VERIFICATION ==="
echo ""

# Function 1: testOnboardingDetection
echo "## 1. testOnboardingDetection Analysis"
echo ""
echo "### Original Logic Flow (source):"
git show fd78eb8:chrome-extension-app/src/background/index.js | sed -n '/globalThis.testOnboardingDetection = async/,/^    };$/p' | grep -E "(if|await|return|results\.|try|catch)" | head -20

echo ""
echo "### Refactored Logic Flow (current):"
sed -n '/globalThis.testOnboardingDetection = async/,/^    };$/p' chrome-extension-app/src/background/index.js | grep -E "(if|await|return|results\.|try|catch)" | head -20

echo ""
echo "### Key Operations Comparison:"
echo "  - Original await count in function: $(git show fd78eb8:chrome-extension-app/src/background/index.js | sed -n '/globalThis.testOnboardingDetection = async/,/^    };$/p' | grep -c 'await ')"
echo "  - Refactored await count in function: $(sed -n '/globalThis.testOnboardingDetection = async/,/^    };$/p' chrome-extension-app/src/background/index.js | grep -c 'await ')"
echo "  - Original results assignments: $(git show fd78eb8:chrome-extension-app/src/background/index.js | sed -n '/globalThis.testOnboardingDetection = async/,/^    };$/p' | grep -c 'results\.')"
echo "  - Refactored results assignments: $(sed -n '/globalThis.testOnboardingDetection = async/,/^    };$/p' chrome-extension-app/src/background/index.js | grep -c 'results\.')"

echo ""
echo "## 2. Critical Data Flow Check"
echo ""

# Check if results.onboardingStatusChecked is still set
echo "### onboardingStatusChecked assignment:"
echo "  Original: $(git show fd78eb8:chrome-extension-app/src/background/index.js | grep -c 'results.onboardingStatusChecked = ')"
echo "  Current: $(grep -c 'results.onboardingStatusChecked = ' chrome-extension-app/src/background/index.js)"

# Check if results.dataStoresValidated is still set
echo "### dataStoresValidated assignment:"
echo "  Original: $(git show fd78eb8:chrome-extension-app/src/background/index.js | grep -c 'results.dataStoresValidated = ')"
echo "  Current: $(grep -c 'results.dataStoresValidated = ' chrome-extension-app/src/background/index.js)"

# Check if criticalDataPresent logic is preserved
echo "### criticalDataPresent logic:"
echo "  Original occurrences: $(git show fd78eb8:chrome-extension-app/src/background/index.js | grep -c 'criticalDataPresent')"
echo "  Current occurrences: $(grep -c 'criticalDataPresent' chrome-extension-app/src/background/index.js)"

echo ""
echo "## 3. Return Value Verification"
echo ""
echo "### testOnboardingDetection return paths:"
git diff fd78eb8 chrome-extension-app/src/background/index.js | grep -A2 -B2 "testOnboardingDetection" | grep -E "return"

echo ""
echo "=== VERIFICATION COMPLETE ==="
