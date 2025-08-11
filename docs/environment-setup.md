# 🛠️ Development Environment Setup

This guide provides detailed instructions for setting up a complete CodeMaster Chrome extension development environment.

## 📋 Table of Contents

- [Prerequisites Installation](#-prerequisites-installation)
- [Chrome Extension Setup](#-chrome-extension-setup)
- [Development Environment](#-development-environment)
- [IndexedDB Development Tools](#-indexeddb-development-tools)
- [Testing Environment](#-testing-environment)
- [IDE Configuration](#-ide-configuration)
- [Debugging Setup](#-debugging-setup)

---

## 🔧 Prerequisites Installation

### Node.js Setup

1. **Install Node.js v16+**
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose LTS version for stability
   - Verify installation:
   ```bash
   node --version  # Should show v16+
   npm --version   # Should show 8+
   ```

2. **Update npm (optional)**
   ```bash
   npm install -g npm@latest
   ```

### Git Configuration

```bash
# Set your identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Useful aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
```

### Chrome Browser Setup

1. **Enable Developer Mode**
   - Navigate to `chrome://extensions/`
   - Toggle **Developer mode** in the top right corner
   - You should see options: "Load unpacked", "Pack extension", "Update"

2. **Install Chrome DevTools Extensions (Optional)**
   - [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
   - [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd)

---

## 🔨 Chrome Extension Setup

### Initial Project Setup

1. **Clone and Setup**
   ```bash
   git clone https://github.com/your-username/codemaster.git
   cd codemaster
   cd Frontend
   npm install
   ```

2. **Development Build**
   ```bash
   npm run dev
   ```
   This starts webpack in watch mode, rebuilding when files change.

3. **Load Extension in Chrome**
   - Go to `chrome://extensions/`
   - Click **Load unpacked**
   - Navigate to and select `Frontend/dist/` folder
   - Extension should appear with CodeMaster icon

### Extension Development Workflow

```bash
# Make code changes in src/
# Webpack rebuilds automatically (dev mode)
# Reload extension in chrome://extensions/
# Test functionality on LeetCode or in popup
```

### Extension Reload Process

After making changes:
1. **Automatic rebuild**: Webpack watch mode handles this
2. **Reload extension**: Click reload button in `chrome://extensions/`
3. **Refresh pages**: Refresh any pages using the extension (like LeetCode)

---

## 📦 Development Environment

### Recommended Directory Structure

```
codemaster/
├── Frontend/
│   ├── src/             # Source code
│   ├── dist/            # Built extension (load this in Chrome)
│   ├── public/          # Static assets and manifest
│   ├── node_modules/    # Dependencies
│   └── package.json     # Project configuration
└── docs/               # Documentation
```

### Package Scripts Overview

```bash
# Development
npm run dev              # Webpack watch mode for development
npm run build            # Production build
npm run dev-server       # Start dev server (if needed)

# Code Quality
npm run lint             # ESLint analysis
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Prettier formatting

# Testing
npm run test             # Run test suite
npm run test:watch       # Watch mode testing
npm run test:coverage    # Coverage report
npm run test:ci          # CI-friendly test run
```

### Environment Variables

Create `.env` file in `Frontend/` directory:

```env
# Development settings
NODE_ENV=development
GENERATE_SOURCEMAP=true

# Extension settings
EXTENSION_ID=your-extension-id-here
API_BASE_URL=https://your-api-url.com

# Debug settings
DEBUG_INDEXEDDB=true
DEBUG_CHROME_MESSAGES=true
```

---

## 🗄️ IndexedDB Development Tools

### Browser DevTools Setup

1. **Open Chrome DevTools** (F12)
2. **Navigate to Application tab**
3. **Find Storage section**
4. **Expand IndexedDB**
5. **Look for "review" database**

### Database Inspection

```
Application → Storage → IndexedDB → review
├── attempts              # Problem attempt records
├── limits               # Time/attempt limits
├── pattern_ladders      # Difficulty progression
├── problems             # User's problem data
├── sessions             # Learning sessions
├── standard_problems    # LeetCode problem database
├── tag_mastery         # Algorithm pattern progress
├── tag_relationships   # Pattern connections
└── ... (13 stores total)
```

### Useful Database Operations

```javascript
// Open browser console on extension page or LeetCode
// Access database directly for debugging

// Get database instance
const db = await indexedDB.open('review', 25);

// List all object stores
console.log(Array.from(db.objectStoreNames));

// Query problems
const tx = db.transaction(['problems'], 'readonly');
const store = tx.objectStore('problems');
const problems = await store.getAll();
console.log(problems);
```

### Database Reset (Development)

```javascript
// Complete database reset (CAREFUL!)
await indexedDB.deleteDatabase('review');
// Reload extension to recreate with fresh schema
```

---

## 🧪 Testing Environment

### Jest Configuration

Tests are pre-configured with:
- **React Testing Library**: Component testing
- **Fake IndexedDB**: Database mocking
- **Jest Environment**: jsdom for browser APIs
- **Coverage**: Built-in coverage reporting

### Running Tests

```bash
# Single test run
npm test

# Watch mode (recommended for development)
npm run test:watch

# Coverage report
npm run test:coverage
# Open coverage/lcov-report/index.html in browser

# CI mode
npm run test:ci
```

### Test File Structure

```
src/
├── shared/
│   ├── hooks/
│   │   ├── useChromeMessage.js
│   │   └── useChromeMessage.test.jsx    # Hook tests
│   ├── services/
│   │   ├── sessionService.js
│   │   └── __tests__/
│   │       └── sessionService.test.js   # Service tests
│   └── components/
│       ├── TimerComponent.jsx
│       └── __tests__/
│           └── TimerComponent.test.jsx  # Component tests
```

### Mock Setup

Key mocks are pre-configured:
- **Chrome APIs**: `chrome.runtime`, `chrome.storage`
- **IndexedDB**: Fake implementation for tests
- **External Services**: LeetCode integration mocks

---

## 💻 IDE Configuration

### Visual Studio Code Setup

**Recommended Extensions**:
```json
{
  "recommendations": [
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-jest",
    "ms-vscode.vscode-chrome-debug"
  ]
}
```

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

**Launch Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Chrome Extension",
      "url": "chrome://extensions/",
      "webRoot": "${workspaceFolder}/Frontend/src"
    }
  ]
}
```

### WebStorm Setup

1. **Enable ESLint**: Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
2. **Enable Prettier**: Languages & Frameworks → JavaScript → Prettier
3. **Configure Jest**: Languages & Frameworks → JavaScript → Testing Frameworks → Jest

---

## 🐛 Debugging Setup

### Chrome Extension Debugging

#### Content Script Debugging
1. Navigate to LeetCode page
2. Open DevTools (F12)
3. Console tab shows content script logs
4. Sources tab shows extension files under "Content Scripts"

#### Background Script Debugging
1. Go to `chrome://extensions/`
2. Find CodeMaster extension
3. Click "Inspect views: background page"
4. New DevTools window opens for background script

#### Popup Debugging
1. Right-click extension icon
2. Select "Inspect popup"
3. DevTools opens for popup interface

#### Standalone App Debugging
1. Navigate to extension's app page
2. Open DevTools normally (F12)

### Debug Console Usage

```javascript
// Chrome message debugging
chrome.runtime.sendMessage({type: 'debug', data: 'test'}, console.log);

// IndexedDB queries
dbHelper.getStore('problems', 'readonly')
  .then(store => store.getAll())
  .then(console.log);

// Service layer debugging
SessionService.getCurrentSession().then(console.log);

// React component debugging (in DevTools console)
$r // Access selected React component
```

### Common Debug Scenarios

#### Extension Not Loading
1. Check `chrome://extensions/` for error messages
2. Verify `manifest.json` syntax
3. Check console for permission errors
4. Ensure `dist/` folder exists and contains built files

#### Content Script Issues
1. Check if content script is injected: Sources → Content Scripts
2. Verify page URL matches manifest patterns
3. Check for JavaScript errors in page console

#### Background Script Problems
1. Inspect background page for errors
2. Check message passing between components
3. Verify service worker registration

#### IndexedDB Issues
1. Check Application → IndexedDB for database
2. Verify database version and schema
3. Look for quota exceeded errors
4. Check transaction failures

---

## 🔄 Hot Reload Setup

### Webpack Dev Server Integration

The development build includes hot reloading:

```bash
npm run dev
```

This provides:
- **Automatic rebuilding** when files change
- **Source maps** for debugging
- **Fast incremental builds**

### Extension Reload Automation

For even faster development, consider:

1. **Extension Auto-Reload** (manual process):
   - Make code changes
   - Extension rebuilds automatically
   - Manually click reload in `chrome://extensions/`

2. **Browser Auto-Refresh** (for content scripts):
   - Refresh LeetCode page after extension reload
   - Content scripts are re-injected automatically

### Development Workflow Optimization

```bash
# Terminal 1: Keep dev build running
npm run dev

# Terminal 2: Run tests in watch mode
npm run test:watch

# Terminal 3: Available for commands
npm run lint
git status
```

---

## 📊 Performance Monitoring

### Build Performance

Monitor webpack build times:
```bash
# Analyze bundle size
npm run build
# Check dist/ folder size

# Webpack bundle analyzer (if configured)
npm run analyze
```

### Runtime Performance

Use Chrome DevTools:
1. **Performance tab**: Profile extension performance
2. **Memory tab**: Check for memory leaks
3. **Network tab**: Monitor any external requests
4. **Application tab**: IndexedDB performance

### IndexedDB Performance

```javascript
// Monitor database operation timing
console.time('database-query');
const result = await dbHelper.getProblems();
console.timeEnd('database-query');
```

---

## 🔐 Security Considerations

### Development Security

- **Never commit secrets** (API keys, tokens) to repository
- **Use environment variables** for sensitive configuration
- **Review dependencies** regularly for vulnerabilities
- **Follow Chrome extension security best practices**

### Content Security Policy

Understand CSP restrictions in `manifest.json`:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

---

## 🚀 Next Steps

After completing environment setup:

1. **Read Architecture Guide**: [Frontend/README.md](../Frontend/README.md)
2. **Review Contribution Guidelines**: [CONTRIBUTING.md](../CONTRIBUTING.md)
3. **Explore Codebase**: Start with `src/shared/` directory
4. **Run Tests**: Ensure everything works with `npm test`
5. **Make Your First Change**: Try modifying a component and see it update

### Quick Development Checklist

- [ ] Node.js 16+ installed
- [ ] Chrome Developer Mode enabled
- [ ] Extension loaded and functional
- [ ] Dev build running (`npm run dev`)
- [ ] Tests passing (`npm test`)
- [ ] Code linting clean (`npm run lint`)
- [ ] Extension debuggable in DevTools

You're now ready to contribute to CodeMaster! 🧠✨

For additional help, see [Troubleshooting Guide](troubleshooting.md) or create an issue on GitHub.