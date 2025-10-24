# Contributing to CodeMaster

Welcome to the CodeMaster contributing guide! This document will help you understand our development workflow, coding standards, and how to make effective contributions.

## Getting Started

1. **Fork and Clone** - Fork the repository and clone your fork locally
2. **Install Dependencies** - Follow the [Installation Guide](../getting-started/installation.md)
3. **Create a Branch** - Create a feature branch for your changes
4. **Make Changes** - Follow our coding standards and testing requirements
5. **Submit PR** - Create a pull request with a clear description

## Development Workflow

### Branch Strategy

We use a feature branch workflow:

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### Branch Naming Conventions

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/improvements
- `chore/description` - Maintenance tasks

### Commit Message Format

We follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```bash
git commit -m "feat(sessions): add adaptive difficulty scaling"
git commit -m "fix(database): resolve IndexedDB transaction timing issue"
git commit -m "docs(api): update service layer documentation"
```

## Code Standards

### JavaScript/React Standards

We follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) with Chrome extension modifications:

```javascript
// ✅ Good
const createSession = async (userPreferences) => {
  const problems = await ProblemService.getSessionProblems(userPreferences);
  return SessionService.buildSession(problems);
};

// ❌ Bad
function createSession(userPreferences) {
  return new Promise((resolve) => {
    ProblemService.getSessionProblems(userPreferences).then((problems) => {
      SessionService.buildSession(problems).then(resolve);
    });
  });
}
```

### Component Standards

React components should follow these patterns:

```javascript
// ✅ Good: Functional component with hooks
const ProblemCard = ({ problem, onSelect }) => {
  const [loading, setLoading] = useState(false);
  const { hints, loading: hintsLoading } = useStrategy(problem.tags);
  
  const handleSelect = useCallback(async () => {
    setLoading(true);
    try {
      await onSelect(problem.id);
    } finally {
      setLoading(false);
    }
  }, [problem.id, onSelect]);

  if (hintsLoading) return <Loader />;

  return (
    <Card>
      <Title>{problem.title}</Title>
      <Button onClick={handleSelect} loading={loading}>
        Select Problem
      </Button>
    </Card>
  );
};

ProblemCard.propTypes = {
  problem: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired
};
```

### Service Layer Standards

Services should follow consistent patterns:

```javascript
// ✅ Good: Service with error handling and clear interface
export const TagService = {
  async getCurrentLearningState() {
    try {
      const mastery = await getTagMastery();
      const ladders = await getPatternLadders();
      
      return this.analyzeLearningState(mastery, ladders);
    } catch (error) {
      console.error('Failed to get learning state:', error);
      throw new Error('Unable to analyze learning progress');
    }
  },

  analyzeLearningState(mastery, ladders) {
    // Business logic implementation
    return {
      focusTags: mastery.filter(t => t.masteryLevel < 0.6),
      masteredTags: mastery.filter(t => t.masteryLevel >= 0.8),
      recommendations: this.generateRecommendations(mastery, ladders)
    };
  }
};
```

### Database Access Rules

**Critical**: Components must never access the database directly.

```javascript
// ✅ Good: Component uses Chrome messaging
const SessionData = () => {
  const { data, loading, error } = useChromeMessage(
    { type: 'getSessionData' },
    [],
    {
      onSuccess: (response) => setSession(response.data),
      onError: (err) => console.error('Failed to load session:', err)
    }
  );
  
  return loading ? <Loader /> : <SessionDetails session={data} />;
};

// ❌ Bad: Component accesses database directly
const SessionData = () => {
  const [session, setSession] = useState(null);
  
  useEffect(() => {
    // Never do this in components
    getSessionById('123').then(setSession);
  }, []);
};
```

### Hook Development Standards

Custom hooks should follow these patterns:

```javascript
// ✅ Good: Comprehensive hook with proper cleanup
export const useStrategy = (problemTags) => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchStrategy = useCallback(async (tags) => {
    if (!tags?.length) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const strategies = await Promise.all(
        tags.map(tag => StrategyService.getTagStrategy(tag))
      );
      setHints(strategies.flat());
    } catch (err) {
      setError(err.message);
      console.error('Strategy fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategy(problemTags);
  }, [problemTags, fetchStrategy]);

  return {
    hints,
    loading,
    error,
    hasHints: hints.length > 0,
    refreshStrategy: () => fetchStrategy(problemTags)
  };
};
```

## Testing Requirements

### Test Coverage Expectations

- **Services**: 90%+ coverage for all public methods
- **Utilities**: 95%+ coverage for pure functions
- **Components**: 80%+ coverage for core functionality
- **Hooks**: 90%+ coverage with proper mocking

### Service Testing Example

```javascript
// services/__tests__/tagService.test.js
import { TagService } from '../tagServices';
import { getTagMastery, getPatternLadders } from '../db/tag_mastery';

jest.mock('../db/tag_mastery');

describe('TagService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentLearningState', () => {
    it('should analyze learning state correctly', async () => {
      // Arrange
      const mockMastery = [
        { tag: 'Array', masteryLevel: 0.4 },
        { tag: 'String', masteryLevel: 0.9 }
      ];
      getTagMastery.mockResolvedValue(mockMastery);
      getPatternLadders.mockResolvedValue([]);

      // Act
      const result = await TagService.getCurrentLearningState();

      // Assert
      expect(result.focusTags).toHaveLength(1);
      expect(result.focusTags[0].tag).toBe('Array');
      expect(result.masteredTags).toHaveLength(1);
      expect(result.masteredTags[0].tag).toBe('String');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      getTagMastery.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(TagService.getCurrentLearningState())
        .rejects.toThrow('Unable to analyze learning progress');
    });
  });
});
```

### Component Testing Example

```javascript
// components/__tests__/ProblemCard.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProblemCard } from '../ProblemCard';

const mockProblem = {
  id: 'two-sum',
  title: 'Two Sum',
  difficulty: 'Easy',
  tags: ['Array', 'Hash Table']
};

describe('ProblemCard', () => {
  it('should render problem information', () => {
    render(<ProblemCard problem={mockProblem} onSelect={jest.fn()} />);
    
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('should call onSelect when button is clicked', async () => {
    const mockOnSelect = jest.fn();
    render(<ProblemCard problem={mockProblem} onSelect={mockOnSelect} />);
    
    fireEvent.click(screen.getByText('Select Problem'));
    
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith('two-sum');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- TagService.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should analyze learning state"
```

## Code Review Process

### Pull Request Guidelines

**Before submitting:**
- [ ] Tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed
- [ ] No console.log statements in production code
- [ ] Performance impact considered

**PR Description Template:**
```markdown
## Description
Brief description of changes

## Changes Made
- [ ] Added new feature X
- [ ] Fixed bug Y
- [ ] Updated documentation for Z

## Testing
- [ ] Added tests for new functionality
- [ ] All existing tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
[Include screenshots for UI changes]

## Breaking Changes
[List any breaking changes]
```

### Code Review Checklist

**Reviewers should check:**
- [ ] **Functionality** - Does the code work as intended?
- [ ] **Architecture** - Does it follow our patterns?
- [ ] **Performance** - Any performance implications?
- [ ] **Security** - Are there security concerns?
- [ ] **Testing** - Is test coverage adequate?
- [ ] **Documentation** - Are docs updated?
- [ ] **Style** - Does it follow our coding standards?

## Architecture Guidelines

### Service Layer Architecture

Services should be stateless and focused on single responsibilities:

```javascript
// ✅ Good: Focused service with clear responsibility
export const ProblemService = {
  // Primary operations
  async createAdaptiveSession(preferences) { /* ... */ },
  async getSessionProblems(criteria) { /* ... */ },
  
  // Supporting operations  
  async getProblemById(id) { /* ... */ },
  async updateProblemMetadata(id, metadata) { /* ... */ }
};

// ❌ Bad: Mixed responsibilities
export const MixedService = {
  createSession() { /* ... */ },
  renderProblemCard() { /* UI logic doesn't belong here */ },
  updateDatabase() { /* Too low-level for service */ }
};
```

### Component Architecture

Components should be focused and composable:

```javascript
// ✅ Good: Focused, composable components
const SessionDashboard = () => (
  <div>
    <SessionStats />
    <ProblemList />
    <ProgressChart />
  </div>
);

const SessionStats = () => {
  const { data } = useSessionData();
  return <StatsCards stats={data.stats} />;
};

// ❌ Bad: Monolithic component
const SessionDashboard = () => {
  // 200+ lines of mixed UI and business logic
};
```

### Database Integration

Always use the service layer for database operations:

```javascript
// ✅ Good: Service layer handles database operations
case "createSession":
  try {
    const session = await ProblemService.createAdaptiveSession(request.params);
    sendResponse({ success: true, session });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
  break;

// ❌ Bad: Background script directly accesses database
case "createSession":
  const problems = await fetchAllProblems(); // Too low-level
  const session = { problems }; // Missing business logic
  sendResponse({ session });
  break;
```

## Performance Guidelines

### Chrome Extension Performance

- **Minimize Background Script Work** - Keep background script lightweight
- **Cache Frequently Accessed Data** - Use Chrome storage for caching
- **Batch Chrome API Calls** - Group related operations
- **Optimize Content Script Size** - Minimize content script bundle size

### Database Performance

- **Use Indexes Efficiently** - Query on indexed fields
- **Batch Database Operations** - Group related transactions
- **Implement Proper Cleanup** - Close cursors and transactions
- **Monitor Query Performance** - Use performance tracking

### React Performance

- **Memoize Expensive Calculations** - Use useMemo for complex computations
- **Optimize Re-renders** - Use useCallback for stable references
- **Lazy Load Components** - Use React.lazy for code splitting
- **Profile Performance** - Use React DevTools Profiler

## Documentation Standards

### Code Documentation

```javascript
/**
 * Creates an adaptive learning session based on user preferences and performance
 * @param {Object} preferences - User preferences for session creation
 * @param {string[]} preferences.tags - Algorithm tags to focus on
 * @param {string} preferences.difficulty - Preferred difficulty level
 * @param {number} preferences.problemCount - Target number of problems
 * @returns {Promise<Object>} Session object with selected problems and metadata
 * @throws {Error} When unable to create session due to insufficient problems
 */
async createAdaptiveSession(preferences) {
  // Implementation
}
```

### API Documentation

Include comprehensive examples in API docs:

```javascript
// Example usage in component
const { data, loading, error } = useChromeMessage(
  { type: 'createSession', preferences: { tags: ['Array'], difficulty: 'Medium' } },
  [preferences],
  {
    onSuccess: (response) => setSession(response.session),
    onError: (error) => setError(error.message)
  }
);
```

## Security Guidelines

### Chrome Extension Security

- **Validate All Inputs** - Sanitize data from web pages
- **Use Content Security Policy** - Restrict script execution
- **Minimize Permissions** - Only request necessary permissions
- **Secure Chrome Storage** - Don't store sensitive data in storage

### Data Security

- **No Hardcoded Secrets** - Use environment variables
- **Sanitize Database Inputs** - Prevent injection attacks
- **Validate API Responses** - Don't trust external data
- **Log Security Events** - Monitor for suspicious activity

## Common Patterns

### Error Handling Pattern

```javascript
const handleAsyncOperation = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const result = await someAsyncOperation();
    setData(result);
  } catch (error) {
    setError(error.message);
    console.error('Operation failed:', error);
  } finally {
    setLoading(false);
  }
};
```

### Chrome Messaging Pattern

```javascript
// Background script handler
case "operationType":
  try {
    const result = await ServiceLayer.performOperation(request.params);
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('Operation failed:', error);
    sendResponse({ success: false, error: error.message });
  }
  break;

// Component usage
const { data, loading, error } = useChromeMessage(
  { type: 'operationType', params: operationParams },
  [dependencies],
  {
    onSuccess: (response) => handleSuccess(response.data),
    onError: (error) => handleError(error)
  }
);
```

## Release Process

### Version Bumping

We use semantic versioning (semver):

- **Patch** (0.0.x) - Bug fixes, minor changes
- **Minor** (0.x.0) - New features, backward compatible
- **Major** (x.0.0) - Breaking changes

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Version bumped appropriately
- [ ] Changelog updated
- [ ] Extension tested in Chrome
- [ ] Performance benchmarks run
- [ ] Security review completed (for major releases)

## Getting Help

### Resources

- **Architecture Questions** - [Architecture Documentation](../architecture/overview.md)
- **API Questions** - [Services API](../api/services-api.md) and [Database API](../api/database-api.md)
- **Bug Reports** - [GitHub Issues](https://github.com/your-repo/issues)
- **Feature Discussions** - [GitHub Discussions](https://github.com/your-repo/discussions)

### Mentorship

New contributors can:
- **Start with "good first issue" labels** - Beginner-friendly issues
- **Join code reviews** - Learn by reviewing others' code  
- **Ask questions** - Create issues with "question" label
- **Pair programming** - Arrange pairing sessions with maintainers

Thank you for contributing to CodeMaster! Your contributions help make algorithm learning more effective for developers worldwide.