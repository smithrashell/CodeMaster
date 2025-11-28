# 🐛 Troubleshooting Guide

This guide covers common issues you might encounter while developing or using the CodeMaster Chrome extension.

## 📋 Table of Contents

- [Chrome Extension Issues](#-chrome-extension-issues)
- [Build System Problems](#-build-system-problems)
- [IndexedDB Issues](#-indexeddb-issues)
- [Testing Problems](#-testing-problems)
- [Development Workflow Issues](#-development-workflow-issues)
- [Performance Problems](#-performance-problems)
- [Content Script Issues](#-content-script-issues)
- [General Debugging Tips](#-general-debugging-tips)

---

## 🔧 Chrome Extension Issues

### Extension Won't Load

**Symptoms**: Error when loading unpacked extension, or extension doesn't appear

**Solutions**:
1. **Check manifest.json syntax**
   ```bash
   # Validate JSON syntax
   cd chrome-extension-app/public
   node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json')))"
   ```

2. **Verify required files exist**
   ```bash
   # Check if all referenced files exist
   ls chrome-extension-app/dist/
   # Should contain: popup.html, background.js, content.js, etc.
   ```

3. **Check Developer Mode**
   - Navigate to `chrome://extensions/`
   - Ensure "Developer mode" toggle is ON (top right)

4. **Permission Issues**
   ```json
   // manifest.json - ensure permissions match your usage
   {
     "permissions": [
       "activeTab",
       "storage",
       "background"
     ],
     "host_permissions": [
       "https://leetcode.com/*"
     ]
   }
   ```

### Extension Loads But Doesn't Work

**Symptoms**: Extension appears but no functionality on LeetCode pages

**Solutions**:
1. **Check content script injection**
   - Open DevTools on LeetCode page
   - Go to Sources → Content Scripts
   - Verify CodeMaster scripts are listed

2. **Verify URL matching**
   ```json
   // manifest.json - check content_scripts matches
   {
     "content_scripts": [{
       "matches": ["https://leetcode.com/problems/*"],
       "js": ["content.js"]
     }]
   }
   ```

3. **Content Security Policy errors**
   - Check browser console for CSP violations
   - Ensure no inline scripts or unsafe-eval usage

### Background Script Not Running

**Symptoms**: Chrome messaging fails, no background processing

**Solutions**:
1. **Check background script registration**
   ```json
   // manifest.json
   {
     "background": {
       "service_worker": "background.js"
     }
   }
   ```

2. **Inspect background script**
   - Go to `chrome://extensions/`
   - Find CodeMaster extension
   - Click "Inspect views: service worker"
   - Check for JavaScript errors

3. **Service Worker lifecycle issues**
   ```javascript
   // background.js - ensure proper event listeners
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     // Handle messages
     return true; // Keep message channel open for async responses
   });
   ```

---

## 🔨 Build System Problems

### Webpack Build Failures

**Symptoms**: `npm run dev` or `npm run build` fails

**Common Solutions**:

1. **Dependency Issues**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Node version incompatibility**
   ```bash
   # Check Node.js version
   node --version  # Should be v16+
   
   # Use Node Version Manager if needed
   nvm use 16
   ```

3. **Memory issues**
   ```bash
   # Increase Node.js memory limit
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

4. **Path issues (Windows)**
   ```bash
   # Use forward slashes in paths
   # Check webpack.config.js path separators
   ```

### ESLint Errors

**Symptoms**: Lint failures preventing builds

**Solutions**:
```bash
# See all linting errors
npm run lint

# Auto-fix what's possible
npm run lint:fix

# Check specific file
npx eslint src/path/to/file.js

# Disable specific rule temporarily
/* eslint-disable-next-line rule-name */
```

### Missing Dependencies

**Symptoms**: Module not found errors

**Solutions**:
```bash
# Install missing dependency
npm install package-name

# Install missing dev dependency
npm install --save-dev package-name

# Check if dependency exists
npm list package-name
```

---

## 🗄️ IndexedDB Issues

### Database Won't Open

**Symptoms**: Database connection errors, data not persisting

**Solutions**:
1. **Clear browser data**
   - Chrome Settings → Privacy and security → Clear browsing data
   - Select "Cookies and other site data" and "Cached images and files"
   - OR manually delete in DevTools: Application → Storage → Clear storage

2. **Check database version conflicts**
   ```javascript
   // If schema changed, increment version in db/index.js
   const DB_VERSION = 37; // Increment from 36
   ```

3. **Storage quota exceeded**
   ```javascript
   // Check storage usage in DevTools
   // Application → Storage → Usage
   
   // Or programmatically
   navigator.storage.estimate().then(console.log);
   ```

### Data Not Saving

**Symptoms**: Data doesn't persist between sessions

**Solutions**:
1. **Transaction errors**
   ```javascript
   // Ensure proper transaction usage
   const tx = db.transaction(['storeName'], 'readwrite');
   const store = tx.objectStore('storeName');
   await store.put(data);
   await tx.complete; // Wait for completion
   ```

2. **Permission issues**
   ```json
   // manifest.json - ensure storage permission
   {
     "permissions": ["storage"]
   }
   ```

3. **Async/await issues**
   ```javascript
   // ✅ Good
   const result = await dbHelper.saveData(data);
   
   // ❌ Bad - not waiting
   dbHelper.saveData(data);
   ```

### Database Schema Migration Issues

**Symptoms**: Old data format causing errors

**Solutions**:
1. **Backup before migrations**
   ```javascript
   // In db/index.js upgrade handler
   if (oldVersion < 26) {
     // Backup existing data
     const backupData = await backupCurrentData();
     // Perform migration
     await migrateToNewSchema();
   }
   ```

2. **Reset database (development only)**
   ```javascript
   // CAREFUL - This deletes all data
   await indexedDB.deleteDatabase('review');
   // Reload extension to recreate
   ```

---

## 🧪 Testing Problems

### Tests Not Running

**Symptoms**: Jest fails to start or find tests

**Solutions**:
1. **Check Jest configuration**
   ```bash
   # Verify Jest setup in package.json
   cat package.json | grep -A 10 "jest"
   ```

2. **Node modules issues**
   ```bash
   # Clear Jest cache
   npx jest --clearCache
   
   # Reinstall dependencies
   rm -rf node_modules
   npm install
   ```

3. **Test file naming**
   ```
   # Jest looks for files matching these patterns:
   *.test.js
   *.test.jsx
   __tests__/*.js
   __tests__/*.jsx
   ```

### Mock Issues

**Symptoms**: Tests fail due to missing mocks or incorrect mock behavior

**Solutions**:
1. **Chrome API mocks**
   ```javascript
   // In test files or setup.js
   global.chrome = {
     runtime: {
       sendMessage: jest.fn(),
       onMessage: {
         addListener: jest.fn()
       }
     },
     storage: {
       local: {
         get: jest.fn(),
         set: jest.fn()
       }
     }
   };
   ```

2. **IndexedDB mocks**
   ```javascript
   // Using fake-indexeddb (already configured)
   import 'fake-indexeddb/auto';
   ```

3. **Service mocks**
   ```javascript
   // Mock service modules
   jest.mock('../services/sessionService', () => ({
     SessionService: {
       createSession: jest.fn(),
       completeSession: jest.fn()
     }
   }));
   ```

### Test Coverage Issues

**Symptoms**: Low coverage or incorrect coverage reports

**Solutions**:
```bash
# Generate detailed coverage
npm run test:coverage

# Check coverage thresholds in package.json
# Adjust if needed for development

# Exclude files from coverage
# Add to jest.config.js collectCoverageFrom
```

---

## 🔄 Development Workflow Issues

### Hot Reload Not Working

**Symptoms**: Changes don't reflect in extension

**Solutions**:
1. **Webpack watch mode**
   ```bash
   # Ensure dev mode is running
   npm run dev
   # Should show "webpack watching for changes..."
   ```

2. **Extension reload required**
   - After code changes, go to `chrome://extensions/`
   - Click reload button on CodeMaster extension
   - Refresh any open LeetCode pages

3. **Port conflicts**
   ```bash
   # Check if webpack dev server port is in use
   netstat -ano | findstr :8080
   # Kill process if needed (Windows)
   taskkill /PID <process_id> /F
   ```

### Git Issues

**Symptoms**: Merge conflicts, branch problems

**Solutions**:
```bash
# Discard local changes
git checkout -- .
git clean -fd

# Resolve merge conflicts
git status
# Edit conflicted files
git add .
git commit -m "Resolve merge conflicts"

# Reset to remote state
git fetch origin
git reset --hard origin/main
```

### VS Code Integration Issues

**Symptoms**: ESLint/Prettier not working in editor

**Solutions**:
1. **Check extension installation**
   - Install ESLint and Prettier VS Code extensions
   - Restart VS Code

2. **Workspace settings**
   ```json
   // .vscode/settings.json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

---

## 🚀 Performance Problems

### Slow Extension Loading

**Symptoms**: Extension takes long to load or respond

**Solutions**:
1. **Bundle size analysis**
   ```bash
   npm run build
   # Check dist/ folder size
   # Look for large files
   ```

2. **Code splitting**
   ```javascript
   // Use dynamic imports for large modules
   const heavyModule = await import('./heavyModule');
   ```

3. **Database optimization**
   ```javascript
   // Add indexes for frequent queries
   store.createIndex('by_date', 'date');
   
   // Use cursors for large datasets
   const cursor = store.openCursor();
   ```

### Memory Leaks

**Symptoms**: Extension becomes slower over time

**Solutions**:
1. **Event listener cleanup**
   ```javascript
   useEffect(() => {
     const listener = (message) => {
       // Handle message
     };
     
     chrome.runtime.onMessage.addListener(listener);
     
     return () => {
       chrome.runtime.onMessage.removeListener(listener);
     };
   }, []);
   ```

2. **Memory profiling**
   - Chrome DevTools → Memory tab
   - Take heap snapshots
   - Look for growing objects

### Slow Database Operations

**Symptoms**: IndexedDB queries taking too long

**Solutions**:
1. **Add database indexes**
   ```javascript
   // In db upgrade handler
   store.createIndex('by_problemId', 'problemId');
   store.createIndex('by_date_and_status', ['date', 'status']);
   ```

2. **Batch operations**
   ```javascript
   // Instead of multiple single operations
   const tx = db.transaction(['problems'], 'readwrite');
   const store = tx.objectStore('problems');
   
   for (const problem of problems) {
     store.put(problem); // All in one transaction
   }
   
   await tx.complete;
   ```

---

## 📄 Content Script Issues

### Content Script Not Injecting

**Symptoms**: No CodeMaster UI appears on LeetCode pages

**Solutions**:
1. **URL pattern matching**
   ```json
   // manifest.json - verify patterns match LeetCode URLs
   {
     "content_scripts": [{
       "matches": [
         "https://leetcode.com/problems/*",
         "https://leetcode.com/problemset/*"
       ]
     }]
   }
   ```

2. **Page loading timing**
   ```json
   // manifest.json - adjust run_at timing
   {
     "content_scripts": [{
       "run_at": "document_end"  // or "document_start"
     }]
   }
   ```

3. **Check DevTools**
   - F12 on LeetCode page
   - Sources → Content Scripts
   - Verify CodeMaster scripts appear

### Content Script Conflicts

**Symptoms**: Extension breaks LeetCode functionality

**Solutions**:
1. **Namespace CSS**
   ```css
   /* Use specific selectors */
   .codemaster-overlay {
     /* styles */
   }
   
   /* Avoid global styles */
   ```

2. **Avoid DOM conflicts**
   ```javascript
   // Check if element exists before modifying
   const existingElement = document.querySelector('.target');
   if (existingElement && !existingElement.classList.contains('codemaster-modified')) {
     // Modify element
     existingElement.classList.add('codemaster-modified');
   }
   ```

---

## 🔍 General Debugging Tips

### Chrome DevTools Usage

1. **Console Debugging**
   ```javascript
   // Use structured logging
   console.group('Session Creation');
   console.log('Input:', sessionData);
   console.log('Result:', result);
   console.groupEnd();
   
   // Performance timing
   console.time('database-operation');
   await dbOperation();
   console.timeEnd('database-operation');
   ```

2. **Network Debugging**
   - DevTools → Network tab
   - Check for failed requests
   - Monitor Chrome extension API calls

3. **Application State**
   - DevTools → Application tab
   - IndexedDB: View database contents
   - Local Storage: Check extension storage
   - Service Workers: Background script status

### Logging Best Practices

```javascript
// Conditional logging for development
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Debug info:', data);
}

// Error logging
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error.message, error.stack);
  // Report to error service in production
}
```

### Common Error Patterns

1. **Async/Await Issues**
   ```javascript
   // ❌ Common mistake
   const results = problems.map(async (problem) => {
     return await processProblemi(problem);
   });
   // Results is array of Promises
   
   // ✅ Correct
   const results = await Promise.all(
     problems.map(async (problem) => {
       return await processProblem(problem);
     })
   );
   ```

2. **Chrome API Callback Hell**
   ```javascript
   // ❌ Old pattern
   chrome.storage.local.get(keys, (result) => {
     chrome.runtime.sendMessage(result, (response) => {
       // Nested callbacks
     });
   });
   
   // ✅ Use useChromeMessage hook
   const { data, loading } = useChromeMessage(
     { type: 'getStorageData', keys },
     [keys]
   );
   ```

---

## 🆘 Getting Additional Help

### Before Asking for Help

1. **Check console for errors**
2. **Try the solutions above**
3. **Search existing GitHub issues**
4. **Create minimal reproduction case**

### Creating Good Bug Reports

Include:
- **Chrome version**: `chrome://version/`
- **Extension version**: Check `chrome://extensions/`
- **Operating system**: Windows/Mac/Linux + version
- **Steps to reproduce**: Detailed sequence
- **Expected vs actual behavior**
- **Console errors**: Copy full error messages
- **Screenshots**: If UI issues

### Useful Commands for Bug Reports

```bash
# System information
node --version
npm --version
chrome --version  # If available from command line

# Extension information
ls -la chrome-extension-app/dist/
cat chrome-extension-app/public/manifest.json

# Build information
npm run build 2>&1 | head -20
```

### Community Resources

- **GitHub Issues**: [Repository Issues](https://github.com/smithrashell/CodeMaster/issues)
- **Chrome Extension Docs**: [Developer Guide](https://developer.chrome.com/docs/extensions/)
- **IndexedDB MDN**: [Web API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- **React Testing Library**: [Testing Documentation](https://testing-library.com/docs/react-testing-library/intro/)

---

## 🔄 Quick Reference Checklists

### Extension Not Working Checklist
- [ ] Developer mode enabled in Chrome
- [ ] Extension loaded successfully (no errors in chrome://extensions/)
- [ ] Webpack build completed without errors
- [ ] Console shows no JavaScript errors
- [ ] Content script injected (visible in DevTools Sources)
- [ ] Background script running (inspect service worker)
- [ ] IndexedDB accessible (DevTools Application tab)

### Development Setup Checklist
- [ ] Node.js v16+ installed
- [ ] Dependencies installed (`npm install` succeeded)
- [ ] Build system working (`npm run dev` runs without errors)
- [ ] Tests passing (`npm test` succeeds)
- [ ] Linting clean (`npm run lint` shows no errors)
- [ ] Extension loadable in Chrome
- [ ] Hot reload working (changes trigger rebuild)

### Performance Debug Checklist
- [ ] Bundle size reasonable (check `dist/` folder)
- [ ] No memory leaks (DevTools Memory tab)
- [ ] Database queries optimized (indexed fields)
- [ ] No excessive re-renders (React DevTools)
- [ ] Event listeners properly cleaned up
- [ ] No blocking synchronous operations

---

If you're still experiencing issues after trying these solutions, please create a detailed bug report on GitHub with the information requested above. The community and maintainers are here to help! 🧠✨