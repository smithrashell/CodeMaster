# 🎣 Hooks API Reference

**Status:** 🚧 Documentation In Progress

Custom React hooks in CodeMaster.

## Available Hooks

### useChromeMessage

**Location:** `src/shared/hooks/useChromeMessage.jsx`

Standardized Chrome runtime messaging hook.

**Usage:**
```javascript
const { data, loading, error } = useChromeMessage(message, dependencies, options);
```

**See:** [Chrome Messaging Guide](../guides/chrome-messaging.md)

### useStrategy

**Location:** `src/shared/hooks/useStrategy.js`

Strategy and hint management hook.

**Usage:**
```javascript
const { hints, loading, hasHints, refreshStrategy } = useStrategy(problemTags);
```

### useThemeColors

**Location:** `src/shared/hooks/useThemeColors.js`

Theme color integration for charts and visualizations.

**Usage:**
```javascript
const colors = useThemeColors();
```

### usePageData

**Location:** `src/app/hooks/usePageData.js`

Dashboard page data fetching hook.

**Usage:**
```javascript
const { data, loading, error, refresh } = usePageData('page-type');
```

---

**Related Documentation:**
- [Chrome Messaging Guide](../guides/chrome-messaging.md)
- [Component Development](../guides/component-development.md)

**Last Updated:** 2025-10-25
