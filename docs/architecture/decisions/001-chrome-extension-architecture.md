# ADR-001: Chrome Extension Architecture

## Status
**Accepted** - Implemented in v0.9.5

## Context
CodeMaster needs to integrate deeply with LeetCode's web interface to provide seamless algorithm learning experiences. We needed to choose between building a standalone web application, a desktop application, or a browser extension.

## Decision
We decided to build CodeMaster as a **Chrome Extension using Manifest v3** architecture.

## Rationale

### Why Chrome Extension?
1. **Seamless Integration**: Direct integration with LeetCode pages without requiring users to switch contexts
2. **User Experience**: Content scripts can overlay UI elements directly on problem pages
3. **Persistent Data**: Chrome storage APIs and IndexedDB provide robust local storage
4. **Cross-Tab Communication**: Background service worker enables coordination across multiple tabs
5. **Distribution**: Chrome Web Store provides easy installation and automatic updates

### Why Manifest v3?
1. **Future-Proofing**: Google's current standard with long-term support
2. **Security**: Enhanced security model with service workers
3. **Performance**: Better resource management and lifecycle
4. **Modern APIs**: Access to latest Chrome extension capabilities

### Architecture Components

#### Multi-Entry Point Design
```
Chrome Extension Architecture:
├── Content Scripts (src/content/)     # LeetCode page integration
├── Service Worker (public/background.js) # Message routing & persistence  
├── Popup Interface (src/popup/)       # Quick access controls
└── Standalone App (src/app/)          # Full dashboard experience
```

#### Data Flow Pattern
```
LeetCode Page → Content Script → Service Worker → IndexedDB
     ↓              ↓               ↓              ↓
User Interaction → React Components → Chrome APIs → Local Storage
```

## Implementation Details

### Content Script Integration
- **Injection Strategy**: Inject into LeetCode problem and problemset pages
- **DOM Integration**: Non-intrusive overlay components
- **Event Handling**: Capture problem data and user interactions
- **Styling**: Isolated CSS to prevent conflicts

### Service Worker Design
- **Message Router**: Central hub for inter-component communication
- **Persistence Layer**: Coordinate IndexedDB operations
- **Chrome API Proxy**: Centralize Chrome API access
- **Background Processing**: Handle analytics and data sync

### Popup Interface
- **Quick Actions**: Session creation, settings, basic stats
- **Navigation**: Links to full dashboard
- **Status Display**: Current session progress

### Standalone Dashboard
- **Full Analytics**: Comprehensive progress visualization
- **Session Management**: Detailed session configuration
- **Data Management**: Import/export, backup/restore

## Consequences

### Positive
- **Deep Integration**: Seamless user experience on LeetCode
- **Local-First**: No server dependencies, fast and reliable
- **Rich UI**: Full React ecosystem for complex interfaces
- **Extensibility**: Easy to add new features and integrations
- **Privacy**: All data stays local to user's machine

### Negative
- **Browser Dependency**: Limited to Chrome (and Chromium-based browsers)
- **Extension Complexity**: More complex than simple web app
- **Distribution**: Requires Chrome Web Store approval
- **Update Coordination**: Need to manage multiple component updates

### Mitigation Strategies
1. **Cross-Browser**: Future consideration for Firefox WebExtensions API
2. **Development Complexity**: Comprehensive documentation and development tools
3. **Testing**: Extensive test coverage for extension-specific functionality
4. **User Onboarding**: Clear installation and usage instructions

## Alternatives Considered

### 1. Standalone Web Application
**Rejected** because:
- Would require users to manually copy/paste problem data
- No direct integration with LeetCode workflow
- Limited ability to capture timing and interaction data

### 2. Desktop Application (Electron)
**Rejected** because:
- No web integration capabilities
- Larger distribution size and complexity
- Platform-specific builds required
- No access to browser APIs

### 3. Browser UserScript (Tampermonkey)
**Rejected** because:
- Limited UI capabilities
- No robust storage options
- Difficult distribution and updates
- Limited to simple overlays

### 4. Mobile Application
**Rejected** because:
- LeetCode is primarily used on desktop
- Limited integration with web platform
- Separate development and maintenance overhead

## Monitoring and Success Metrics

### Technical Metrics
- **Extension Load Time**: < 500ms initial load
- **Memory Usage**: < 50MB peak usage
- **IndexedDB Performance**: < 100ms average query time
- **Chrome API Response**: < 200ms message passing

### User Experience Metrics
- **Installation Success Rate**: > 95%
- **Feature Usage**: Content script engagement > 80%
- **Crash Rate**: < 0.1% of sessions
- **User Retention**: 7-day retention > 60%

## Future Considerations

### Potential Migrations
1. **Cross-Browser Support**: WebExtensions API standardization
2. **Progressive Web App**: If browser integration requirements change
3. **Native Integration**: If LeetCode provides official API access

### Architecture Evolution
1. **Micro-Extensions**: Split into smaller, focused extensions
2. **Cloud Sync**: Optional cloud storage for cross-device sync
3. **AI Integration**: Enhanced problem recommendations via ML

## References
- [Chrome Extension Manifest v3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [IndexedDB API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [React Chrome Extension Best Practices](https://github.com/extend-chrome/documentation)

## Related ADRs
- ADR-002: IndexedDB Storage Strategy
- ADR-003: Hook-Based Component Architecture
- ADR-004: Service Layer Design Pattern