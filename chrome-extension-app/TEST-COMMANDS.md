# 🧪 **TEST COMMANDS QUICK REFERENCE**

## **🚀 How to Run Tests**

### **Step 1: Build Extension**
```bash
npm run build
```

### **Step 2: Open Service Worker Console**
1. Go to `chrome://extensions/`
2. Find "CodeMaster" extension
3. Click "Service Worker" link
4. Use DevTools Console that opens

### **Step 3: Run Tests**

## **🎯 Main Test Commands**

```javascript
// 🌟 ALL TESTS (55+ comprehensive suite)
await runComprehensiveTests()

// 🔥 CRITICAL TESTS (9 essential tests)
await runCriticalTests()

// 🚀 PRODUCTION TESTS (9 deployment-ready tests)
await runProductionTests()

// ⚡ QUICK HEALTH CHECK (3 essential tests)
await quickHealthCheck()

// 🔧 DEVELOPMENT TESTS (6 dev-focused tests)
await runDevTests()
```

## **🔇 Service Worker Safe Modes**
*Minimal console output to prevent service worker crashes*

```javascript
// 🌟 ALL TESTS - Silent mode (best for service workers)
await runTestsSilent()

// 🔥 CRITICAL TESTS - Silent mode
await runCriticalTestsSilent()

// 🚀 PRODUCTION TESTS - Silent mode
await runProductionTestsSilent()
```

## **📋 Phase-Specific Tests**

```javascript
await runPhase0Tests()  // Browser Integration (6 tests)
await runPhase1Tests()  // User Workflows (5 tests)
await runPhase2Tests()  // Algorithm & Learning (29 tests)
await runPhase3Tests()  // Experience Quality (4 tests)
await runPhase4Tests()  // Defensive Testing (2 tests)
await runPhase5Tests()  // Performance & Production (4 tests)
await runPhase6Tests()  // Advanced Production (3 tests)
```

## **🔍 Utility Commands**

```javascript
// List all available test functions
listAvailableTests()

// Run individual tests
await testSessionGeneration({ verbose: true })
await testPerformanceBenchmarks({ verbose: true })
await testProductionReadiness({ verbose: true })
```

## **📊 Understanding Results**

- **90%+**: 🎉 **EXCELLENT** - Production ready!
- **75-89%**: 👍 **GOOD** - Minor issues only
- **50-74%**: ⚠️ **NEEDS ATTENTION** - Several problems
- **<50%**: 🚨 **CRITICAL** - Major issues detected

---

**🎯 Quick Start:** `await runCriticalTests()` for essential health check!
**🌟 Full Suite:** `await runComprehensiveTests()` for complete validation!
**🚀 Deployment:** `await runProductionTests()` before going live!