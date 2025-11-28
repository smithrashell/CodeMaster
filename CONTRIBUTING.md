# 🤝 Contributing to CodeMaster

Welcome to the CodeMaster Chrome extension project! This guide will help you get started with contributing to our algorithm mastery learning platform.

**Important**: By submitting code, you agree to our [Contributor License Agreement](#contributor-license-agreement-cla).

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Development Setup](#-development-setup)
- [Project Architecture](#-project-architecture)
- [Development Workflow](#-development-workflow)
- [Code Standards](#-code-standards)
- [Testing Guidelines](#-testing-guidelines)
- [Chrome Extension Development](#-chrome-extension-development)
- [Pull Request Process](#-pull-request-process)
- [Issue Guidelines](#-issue-guidelines)
- [Recognition](#recognition)

---

## Code of Conduct

### Our Pledge

We pledge to make participation in CodeMaster a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Expected Behavior

- ✅ Be respectful and inclusive
- ✅ Provide constructive feedback
- ✅ Accept criticism gracefully
- ✅ Focus on what's best for the project and community

### Unacceptable Behavior

- ❌ Harassment, trolling, or personal attacks
- ❌ Publishing others' private information
- ❌ Any conduct that would be inappropriate in a professional setting

**Enforcement**: Violations may result in removal from the project. Contact RashellSSmith@gmail.com to report issues.

---

## Contributor License Agreement (CLA)

**By submitting code to CodeMaster, you agree to the following terms:**

### Grant of Copyright License

You hereby grant to Rashell Smith (the "Project Owner") and to recipients of software distributed by the Project a **perpetual, worldwide, non-exclusive, royalty-free, irrevocable copyright license** to:

1. **Use** your contributions in CodeMaster
2. **Reproduce, modify, and create derivative works** from your contributions
3. **Publicly display and perform** your contributions
4. **Distribute** your contributions under any license, including:
   - The current GNU AGPL v3 license
   - Future alternative commercial licenses
   - Any other open source or proprietary license

### Grant of Patent License

You grant the Project Owner a **perpetual, worldwide, non-exclusive, royalty-free, irrevocable patent license** to:
- Make, use, sell, and import your contributions
- License your contributions under different terms

### Representations and Warranties

You represent and warrant that:

1. **Original Work**: Your contribution is your original creation OR you have rights to submit it
2. **Legal Right**: You have legal authority to grant the above licenses
3. **Third-Party Code**: If your contribution includes third-party code:
   - You have identified all such code
   - The third-party code is compatible with AGPL v3
   - You have included proper attribution

### What This Means

✅ **You can:**
- Publicly claim you contributed to CodeMaster
- Use your contributions in your own projects
- Fork CodeMaster under AGPL v3 terms

✅ **Project Owner can:**
- Include your contribution in CodeMaster
- Sell commercial licenses of CodeMaster (including your contribution)
- Change CodeMaster's license in the future
- Enforce copyright on your contribution

❌ **You cannot:**
- Revoke this license
- Prevent commercial licensing of your contribution
- Claim exclusive rights to your contribution once submitted

### Why This CLA Exists

This CLA allows CodeMaster to:
1. **Dual license**: Offer AGPL v3 for community + paid licenses for businesses
2. **Enforce copyright**: Take legal action against license violations
3. **Future flexibility**: Migrate to a different license if needed
4. **Protect contributors**: Clear legal standing for all contributions

**If you're uncomfortable with these terms**, you can contribute by:
- Reporting bugs
- Suggesting features
- Improving documentation (docs-only PRs may not require CLA)
- Supporting the community

### Acceptance

**By submitting a Pull Request, you indicate your acceptance of this CLA.**

For corporate contributors or questions, contact: RashellSSmith@gmail.com

---

## 🚀 Development Setup

### Prerequisites

- **Node.js** v16+ and npm
- **Google Chrome** with Developer Mode enabled
- **Git** for version control
- Basic understanding of React, Chrome extensions, and IndexedDB

### Initial Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/smithrashell/CodeMaster.git
   cd CodeMaster
   ```

2. **Install dependencies**
   ```bash
   cd chrome-extension-app
   npm install
   ```

3. **Start development build**
   ```bash
   npm run dev
   ```

4. **Load extension in Chrome**
   - Navigate to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select `chrome-extension-app/dist/`

### Development Commands

```bash
# Core development
npm run dev          # Development build with watch mode
npm run build        # Production build
npm run lint         # ESLint code analysis
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Prettier code formatting

# Testing
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

---

## 🏗️ Project Architecture

CodeMaster follows a layered architecture pattern:

### Directory Structure

```
chrome-extension-app/src/
├── app/              # Standalone dashboard application
├── content/          # LeetCode page content scripts
├── popup/            # Extension popup interface
└── shared/           # Shared code across all entry points
    ├── components/   # Reusable React components
    ├── hooks/        # Custom React hooks
    ├── services/     # Business logic layer (17 services)
    ├── db/           # IndexedDB utilities (13 stores)
    ├── utils/        # Helper functions
    └── providers/    # React context providers
```

### Key Architectural Principles

1. **Service Layer Pattern**: All business logic goes through services, never direct DB access from components
2. **Hook-Based State**: Use custom hooks for complex state management (see `useChromeMessage`)
3. **Component Separation**: Shared components for reusability, specific components in their respective domains
4. **Chrome Extension Patterns**: Standardized messaging via `useChromeMessage` hook

### Data Flow

```
Components → Custom Hooks → Services → Database Layer (IndexedDB)
     ↓           ↓            ↓              ↓
Chrome Extension APIs ← Background Script ← Chrome Runtime
```

---

## 🔄 Development Workflow

### Branch Naming Convention

- `feat/feature-name-123` - New features (reference issue number)
- `fix/bug-description-123` - Bug fixes
- `docs/documentation-update-123` - Documentation changes
- `refactor/component-name-123` - Code refactoring
- `test/test-description-123` - Test additions/improvements

### Commit Message Format

Follow conventional commit standards:

```
type(scope): brief description

Detailed description if needed

Fixes #123
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Examples**:
```
feat(hooks): implement useChromeMessage hook for Chrome API standardization

fix(timer): resolve timer component re-rendering issue in content script

docs(readme): add comprehensive installation instructions
```

### Development Process

1. **Create feature branch** from `main`
2. **Implement changes** following code standards
3. **Write/update tests** ensuring coverage
4. **Run linting and tests** locally
5. **Test Chrome extension** functionality
6. **Commit with proper messages**
7. **Push and create pull request**

---

## 📏 Code Standards

### ESLint Configuration

We use **ESLint with Airbnb base** configuration:

- **React Hooks Rules**: Enforced dependency arrays and hook usage
- **Clean Code Plugin**: Promotes readable, maintainable code
- **JSX a11y**: Accessibility best practices
- **Prettier Integration**: Automatic code formatting

### Code Style Guidelines

#### React Components

```javascript
// ✅ Good: Functional component with hooks
import React, { useState, useEffect, useCallback } from 'react';
import { useChromeMessage } from '../hooks/useChromeMessage';

const ProblemGenerator = () => {
  const [problems, setProblems] = useState([]);
  
  const { data, loading, error } = useChromeMessage(
    { type: 'getCurrentSession' },
    [],
    {
      onSuccess: (response) => setProblems(response.problems),
      onError: (err) => console.error('Session load failed:', err)
    }
  );

  return (
    <div className="problem-generator">
      {loading ? <LoadingSpinner /> : <ProblemList problems={problems} />}
    </div>
  );
};

export default ProblemGenerator;
```

#### Custom Hooks

```javascript
// ✅ Good: Custom hook pattern
export const useStrategy = (problemTags) => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshStrategy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const strategyData = await StrategyService.getTagStrategy(problemTags);
      setHints(strategyData.hints);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [problemTags]);

  useEffect(() => {
    if (problemTags?.length > 0) {
      refreshStrategy();
    }
  }, [problemTags, refreshStrategy]);

  return {
    hints,
    loading,
    error,
    hasHints: hints.length > 0,
    refreshStrategy,
  };
};
```

#### Service Layer

```javascript
// ✅ Good: Service pattern
export const SessionService = {
  async createSession(problems) {
    try {
      const sessionData = {
        id: generateId(),
        problems,
        startTime: Date.now(),
        status: 'active'
      };
      
      await dbHelper.saveSession(sessionData);
      return sessionData;
    } catch (error) {
      console.error('Session creation failed:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  },

  async completeSession(sessionId, results) {
    // Implementation...
  }
};
```

### Naming Conventions

#### Variable & Export Names
- **Components**: PascalCase (`ProblemGenerator`, `TimerComponent`)
- **Hooks**: camelCase with `use` prefix (`useChromeMessage`, `useStrategy`)
- **Services**: PascalCase with `Service` suffix (`SessionService`, `ProblemService`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TIME_LIMIT`)

#### File Names

| File Type | Convention | Example |
|-----------|------------|---------|
| **Components** (.jsx) | PascalCase | `ProblemGenerator.jsx`, `TimerComponent.jsx` |
| **Services** (.js) | camelCase | `sessionService.js`, `problemService.js` |
| **Hooks** (.js) | camelCase with `use` prefix | `useChromeMessage.js`, `useStrategy.js` |
| **Helpers** (.js) | camelCase with `Helpers` suffix | `leitnerHelpers.js`, `focusAreasHelpers.js` |
| **Utils** (.js) | camelCase | `logger.js`, `errorHandler.js` |
| **DB Modules** (.js) | snake_case | `pattern_ladder.js`, `hint_interactions.js` |

**Rationale:**
- `.jsx` files use PascalCase to match React component naming conventions
- `.js` files use camelCase for consistency with JavaScript module conventions
- DB modules use snake_case to match their corresponding IndexedDB store names
- The export name (e.g., `SessionService`) can differ from the file name (`sessionService.js`)

---

## 🧪 Testing Guidelines

### Testing Stack

- **Jest**: Testing framework
- **React Testing Library**: Component testing
- **Fake IndexedDB**: Database mocking
- **110 total tests** currently passing

### Test Structure

```javascript
// Component test example
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemGenerator } from '../ProblemGenerator';

// Mock dependencies
jest.mock('../hooks/useChromeMessage');

describe('ProblemGenerator', () => {
  beforeEach(() => {
    // Setup mocks
    useChromeMessage.mockReturnValue({
      data: mockSessionData,
      loading: false,
      error: null
    });
  });

  it('should display problems when session loads', async () => {
    render(<ProblemGenerator />);
    
    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
    });
  });

  it('should handle session creation', async () => {
    const user = userEvent.setup();
    render(<ProblemGenerator />);
    
    await user.click(screen.getByRole('button', { name: /generate session/i }));
    
    expect(mockCreateSession).toHaveBeenCalled();
  });
});
```

### Hook Testing

```javascript
// Hook test example
import { renderHook, act } from '@testing-library/react';
import { useStrategy } from '../useStrategy';

describe('useStrategy', () => {
  it('should load strategy data for given tags', async () => {
    const { result } = renderHook(() => 
      useStrategy(['dynamic-programming', 'array'])
    );

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    expect(result.current.hints).toHaveLength(3);
    expect(result.current.hasHints).toBe(true);
  });
});
```

### Testing Requirements

- **All new features** must include tests
- **Bug fixes** should include regression tests
- **Hooks** must have isolated unit tests
- **Services** should have comprehensive test coverage
- **Components** need integration tests for user interactions

---

## 🔧 Chrome Extension Development

### Extension Architecture

CodeMaster uses **Manifest v3** with these components:

- **Content Scripts**: Inject into LeetCode pages
- **Service Worker**: Background processing and message routing
- **Popup**: Quick access interface
- **Standalone App**: Full dashboard experience

### Chrome API Patterns

Always use the `useChromeMessage` hook for Chrome API interactions:

```javascript
// ✅ Good: Standardized Chrome messaging
const { data, loading, error } = useChromeMessage(
  { type: 'getSettings' },
  [],
  {
    onSuccess: (response) => setSettings(response.settings),
    onError: (error) => setError(`Settings load failed: ${error}`)
  }
);

// ❌ Bad: Direct Chrome API usage
useEffect(() => {
  chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
    setSettings(response.settings);
  });
}, []);
```

### Extension Debugging

1. **Reload Extension**: After code changes, click reload button in `chrome://extensions/`
2. **Inspect Popup**: Right-click extension icon → Inspect popup
3. **Content Script Debugging**: Open DevTools on LeetCode pages
4. **Background Script**: Go to extension details → Inspect views: background page
5. **IndexedDB Inspection**: Application tab → Storage → IndexedDB → review (database)

### Development Tips

- **Hot Reloading**: Use `npm run dev` for automatic rebuilds
- **Console Logging**: Use `console.log` liberally during development
- **Permission Issues**: Check manifest.json permissions match your API usage
- **Content Security Policy**: Ensure all external resources are allowed

---

## 🔍 Pull Request Process

### Before Submitting

1. **Run full test suite**: `npm run test`
2. **Lint your code**: `npm run lint`
3. **Test extension functionality**: Load unpacked extension and verify features
4. **Update documentation**: If you change APIs or add features
5. **Check bundle size**: Ensure no unnecessary dependencies added

### PR Template

```markdown
## Summary
Brief description of changes and motivation

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Test additions

## Testing
- [ ] All tests pass
- [ ] Extension loads without errors
- [ ] Feature tested in Chrome
- [ ] Regression testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)

## Related Issues
Fixes #123
Relates to #456
```

### Review Process

1. **Automated Checks**: All tests and linting must pass
2. **Peer Review**: At least one code review required
3. **Manual Testing**: Reviewer tests Chrome extension functionality
4. **Documentation Review**: Ensure docs are updated for user-facing changes

---

## 📝 Issue Guidelines

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
Clear description of the issue

**Steps to Reproduce**
1. Go to LeetCode problem page
2. Click extension icon
3. Select "Generate Session"
4. Error occurs

**Expected Behavior**
What should have happened

**Environment**
- Chrome Version: 120.0.6099.129
- Extension Version: v0.9.5
- Operating System: Windows 11

**Screenshots**
If applicable, add screenshots

**Browser Console Logs**
Any relevant console errors
```

### Feature Requests

Include:
- **Clear description** of the feature
- **Use case**: Why is this needed?
- **Proposed solution**: How might this work?
- **Alternatives considered**: Other approaches you thought about

### Questions and Discussions

- Search existing issues first
- Use clear, descriptive titles
- Provide context and examples
- Tag appropriately (`question`, `discussion`, etc.)

---

## 🎯 Development Best Practices

### Performance Considerations

- **IndexedDB Operations**: Use transactions for multiple operations
- **Chrome Message Passing**: Batch messages when possible
- **Component Rendering**: Use React.memo for expensive components
- **Memory Leaks**: Always cleanup event listeners and timers

### Security Guidelines

- **Never log sensitive data** (user problems, personal info)
- **Sanitize user inputs** before storing in IndexedDB
- **Follow Chrome extension security best practices**
- **Review third-party dependencies** for security issues

### Accessibility

- **Use semantic HTML** elements where possible
- **Provide keyboard navigation** for all interactive elements
- **Include ARIA labels** for screen readers
- **Ensure sufficient color contrast**

### Error Handling

- **Always handle async operation failures**
- **Provide meaningful error messages to users**
- **Log errors for debugging** but don't expose sensitive information
- **Implement graceful degradation** when possible

---

## 📚 Additional Resources

### Documentation Links

- **[chrome-extension-app README.md](chrome-extension-app/README.md)** - Comprehensive technical architecture
- **[Database Layer](chrome-extension-app/src/shared/db/README.md)** - IndexedDB schema and utilities
- **[Services Layer](chrome-extension-app/src/shared/services/README.md)** - Business logic documentation
- **[Chrome Extension Guide](docs/environment-setup.md)** - Detailed development setup

### Learning Resources

- **[Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)** - Official Chrome extension docs
- **[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)** - Testing best practices
- **[IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)** - Browser database API
- **[ESLint Rules](https://eslint.org/docs/rules/)** - Code quality standards

### Getting Help

- **GitHub Issues**: For bugs, feature requests, and technical questions
- **Code Review**: Ask for feedback on complex implementations
- **Architecture Discussions**: Propose significant changes in issues first

---

## Recognition

### Contributors List

All code contributors will be added to `CONTRIBUTORS.md` with:
- Your name (GitHub username if you prefer)
- Link to your GitHub profile
- Brief description of contributions

### Hall of Fame

Significant contributors may be recognized in:
- README.md acknowledgments
- Chrome Web Store listing (if substantial contribution)
- Project website (future)

### Ways to Contribute Beyond Code

- Report high-quality bugs
- Suggest valuable features
- Help other users in issues/discussions
- Write tutorials or blog posts
- Share CodeMaster with your network

---

Thank you for contributing to CodeMaster! 🧠✨

Your contributions help developers worldwide master algorithms more effectively through intelligent spaced repetition and personalized learning.