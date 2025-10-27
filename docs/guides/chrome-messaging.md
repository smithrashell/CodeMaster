# 📬 Chrome Messaging Guide

**Status:** 🚧 Documentation In Progress

Guide for using Chrome extension messaging with the useChromeMessage hook.

## useChromeMessage Hook

**Location:** `src/shared/hooks/useChromeMessage.jsx`

Standardized hook for all Chrome runtime messaging.

## Usage Pattern

```javascript
import { useChromeMessage } from '../shared/hooks/useChromeMessage';

const MyComponent = () => {
  const { data, loading, error } = useChromeMessage(
    { type: 'getSettings' },  // Message object
    [],                       // Dependencies
    {
      onSuccess: (response) => {
        console.log('Success:', response);
      },
      onError: (error) => {
        console.error('Error:', error);
      }
    }
  );

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;

  return <div>{/* Use data */}</div>;
};
```

## Message Types

See `public/background.js` for all available message types.

## Best Practices

1. **Use the Hook** - Never use `chrome.runtime.sendMessage` directly
2. **Handle Loading** - Always handle loading states
3. **Handle Errors** - Provide user-friendly error messages
4. **Dependencies** - Properly specify useEffect dependencies
5. **Callbacks** - Use onSuccess/onError for side effects

---

**Related Documentation:**
- [Chrome Extension Architecture](../architecture/chrome-extension.md)
- [Hook APIs](../api/hooks-api.md)

**Last Updated:** 2025-10-25
