# 🧩 Component Development Guide

**Status:** 🚧 Documentation In Progress

Guide for creating new React components in CodeMaster.

## Component Location Rules

**Dashboard Components:** `src/app/components/[feature]/`
**Content Script Components:** `src/content/components/[feature]/`
**Shared Components:** `src/shared/components/[category]/`

## Component Structure

```javascript
import React from 'react';
import styles from './Component.module.css';

/**
 * Component description
 */
export const ComponentName = ({ prop1, prop2 }) => {
  // Component logic

  return (
    <div className={styles.container}>
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
```

## Best Practices

1. **Functional Components** - Use functional components with hooks
2. **PropTypes/TypeScript** - Document expected props
3. **CSS Modules** - Use CSS modules for styling
4. **Naming** - PascalCase for components, camelCase for files
5. **Co-located Tests** - Place tests in `__tests__/` subdirectory

## Testing

Create tests in `__tests__/[ComponentName].test.jsx`

---

**Related Documentation:**
- [Project Structure](../architecture/project-structure.md)
- [Coding Standards](../development/coding-standards.md)

**Last Updated:** 2025-10-25
