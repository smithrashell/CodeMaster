# CodeMaster Chrome Extension

This directory contains the Chrome extension source code for CodeMaster.

## Quick Start

```bash
npm install
npm run dev      # Development build with watch
npm run build    # Production build
npm test         # Run tests
npm run lint     # Check for linting issues
```

## Directory Structure

```
chrome-extension-app/
├── src/
│   ├── app/              # Standalone dashboard application
│   ├── content/          # Content scripts for LeetCode integration
│   ├── popup/            # Extension popup interface
│   ├── background/       # Background script entry points
│   └── shared/           # Shared code (hooks, services, components, db)
├── public/               # Static assets and manifest
├── scripts/              # Development utility scripts
└── test/                 # Jest test setup and utilities
```

## Testing

Tests are split into two layers:

- **Unit tests** (Jest): Located in `__tests__/` folders alongside source code throughout `src/`. Run with `npm test`. Uses `test/setup.js` for Chrome API mocks, fake-indexeddb, and global test utilities.
- **Browser integration tests**: Located in `src/background/core-business-tests.js`. These run inside the actual Chrome extension background script during development builds (`background.development.js` imports and initializes them). They exercise real IndexedDB and service interactions in the browser environment.

## Documentation

For comprehensive documentation, see the main project docs:
- **[Project Documentation](../docs/)** - Architecture, API, features, and guides
- **[CLAUDE.md](CLAUDE.md)** - Development commands and architecture overview

## Key Resources

- **Services**: `src/shared/services/` - Business logic layer
- **Database**: `src/shared/db/` - IndexedDB utilities
- **Hooks**: `src/shared/hooks/` - Custom React hooks
- **Components**: `src/shared/components/` - Reusable UI components

## Build Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development build with watch mode |
| `npm run build` | Production build |
| `npm run build:dev` | Development build (no watch) |
| `npm run build:analyze` | Production build with bundle analyzer |
| `npm test` | Run Jest tests |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | Auto-fix linting issues |
