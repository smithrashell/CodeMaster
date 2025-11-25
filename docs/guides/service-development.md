# ⚙️ Service Development Guide

**Status:** 🚧 Documentation In Progress

Guide for creating new services in CodeMaster's service layer.

## Service Location

**All Services:** `src/shared/services/[serviceName].js`

## Service Pattern

```javascript
/**
 * ServiceName - Description
 */
export const ServiceName = {
  /**
   * Method description
   */
  async methodName(params) {
    try {
      // Service logic
      // Access database through db layer
      return result;
    } catch (error) {
      console.error('ServiceName.methodName error:', error);
      throw new Error(`Failed to perform operation: ${error.message}`);
    }
  }
};
```

## Best Practices

1. **Stateless** - Services don't maintain internal state
2. **Database Abstraction** - All DB access through service layer
3. **Error Handling** - Comprehensive try/catch with meaningful errors
4. **Documentation** - JSDoc comments for all methods
5. **Testing** - Comprehensive unit tests

## Service Categories

- **Core Services** - Business logic (Problem, Session, Tag, Attempts)
- **Infrastructure** - System services (ChromeAPI, IndexedDB, DatabaseProxy)
- **Feature Services** - Feature-specific logic (Strategy, Dashboard, Onboarding)

---

**Related Documentation:**
- [Services API](../api/services-api.md)
- [Project Structure](../architecture/project-structure.md)

**Last Updated:** 2025-11-25
