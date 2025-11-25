# Installation & Quick Start

Get CodeMaster running locally in under 15 minutes.

## Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Google Chrome** browser with Developer Mode enabled
- **Git** for version control

## Quick Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/smithrashell/CodeMaster.git
cd CodeMaster

# Navigate to the Chrome extension directory
cd chrome-extension-app

# Install dependencies
npm install
```

### 2. Build the Extension

```bash
# Development build with watch mode
npm run dev

# Or production build
npm run build
```

### 3. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `chrome-extension-app/dist` folder
5. The CodeMaster extension should now appear in your extensions

### 4. Verify Installation

1. Visit [LeetCode](https://leetcode.com/problemset/algorithms/) to see the extension in action
2. Click the CodeMaster extension icon in your browser toolbar
3. Open the standalone dashboard to explore analytics features

## Development Setup

### Available Commands

```bash
# Development
npm run dev          # Development build with watch mode
npm run build        # Production build
npm run lint         # Code linting
npm run lint:fix     # Auto-fix linting issues
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode
npm run format       # Format code with Prettier
```

### Project Structure

```
CodeMaster/
├── chrome-extension-app/     # Main Chrome extension code
│   ├── src/
│   │   ├── app/             # Standalone dashboard application
│   │   ├── content/         # LeetCode page integration
│   │   ├── popup/           # Extension popup interface
│   │   └── shared/          # Shared utilities, services, components
│   ├── public/              # Extension manifest and assets
│   └── dist/                # Built extension files (load this in Chrome)
├── docs/                    # Documentation (you are here!)
└── README.md                # Project overview
```

## Troubleshooting Installation

### Common Issues

**Build fails with "Module not found":**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Extension doesn't load in Chrome:**
- Ensure you selected the `dist` folder, not the root project folder
- Check the Chrome extensions page for error messages
- Try disabling and re-enabling the extension

**Content script not injecting on LeetCode:**
- Check that the extension has permission to access LeetCode
- Refresh the LeetCode page after loading the extension
- Check browser console for JavaScript errors

### Getting Help

- [Common Issues Guide](../troubleshooting/common-issues.md)
- [GitHub Issues](https://github.com/smithrashell/CodeMaster/issues) for bug reports
- [Contributing Guide](../development/contributing.md) for development questions

## Next Steps

After installation:

1. **Understand the Architecture** - Read [Architecture Overview](../architecture/overview.md)
2. **Explore the Features** - Learn about [Leitner System](../features/leitner-system.md) and [Adaptive Sessions](../features/adaptive-sessions.md)  
3. **Start Contributing** - Follow [Contributing Guide](../development/contributing.md)
4. **Review the APIs** - Check [Services API](../api/services-api.md) and [Database API](../api/database-api.md)

## Development Environment Configuration

### VS Code Setup (Recommended)

Install these extensions for the best development experience:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint", 
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-chrome-debug"
  ]
}
```

### ESLint Configuration

The project uses strict ESLint rules. Key configurations:

- **Airbnb React configuration** with Chrome extension modifications
- **Chrome extension globals** (chrome, browser APIs)
- **React hooks rules** for proper hook usage
- **Import ordering** and path resolution

### Testing Setup

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

The project maintains **110+ tests** across services, components, and utilities.

## Environment Variables

Create a `.env` file in `chrome-extension-app/` for development configuration:

```env
# Mock data configuration
USE_MOCK_SERVICE=true
MOCK_DASHBOARD_SERVICE=true
SHOW_MOCK_INDICATORS=true

# Development settings
NODE_ENV=development
DEBUG_MODE=true
```

## Chrome Extension Debugging

### Debug the Extension

1. **Background Script**: `chrome://extensions/` → Click "Inspect views: background page"
2. **Content Script**: Right-click on LeetCode page → "Inspect" → Check console
3. **Popup**: Right-click extension icon → "Inspect popup"
4. **Storage**: Chrome DevTools → Application tab → Storage section

### Common Debug Scenarios

**Check Chrome messaging:**
```javascript
// In background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
});

// In content script or popup
chrome.runtime.sendMessage({type: 'debug'}, (response) => {
  console.log('Response:', response);
});
```

**Monitor IndexedDB:**
```javascript
// Open browser console on any CodeMaster page
// Access database directly for debugging
const request = indexedDB.open('review', 25);
request.onsuccess = (event) => {
  const db = event.target.result;
  console.log('Database stores:', Array.from(db.objectStoreNames));
};
```

## Build Configuration

### Webpack Setup

The project uses multiple Webpack configurations:

- `webpack.dev.js` - Development build with HMR
- `webpack.prod.js` - Production build with optimization
- `webpack.minimal.js` - Minimal build for testing
- `webpack.test.js` - Test-specific build configuration

### Chrome Extension Manifest

Key manifest.json configurations:

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "activeTab", 
    "scripting"
  ],
  "host_permissions": [
    "https://leetcode.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ]
}
```

## Performance Considerations

### Development Mode

- **Hot Module Replacement** - Changes reload automatically in development
- **Source Maps** - Full debugging support with original TypeScript/JSX
- **Mock Data** - Faster development without real database operations
- **Debug Logging** - Verbose logging enabled in development builds

### Production Mode

- **Minification** - Code is minified and optimized
- **Tree Shaking** - Unused code is removed
- **Asset Optimization** - Images and styles are compressed
- **Performance Monitoring** - Runtime performance tracking enabled

You're now ready to start developing with CodeMaster! Continue to [Architecture Overview](../architecture/overview.md) to understand how the system works.