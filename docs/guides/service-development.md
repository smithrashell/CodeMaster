# ⚙️ Service Development Guide

**Status:** 🚧 Documentation In Progress

Guide for creating new services in CodeMaster's service layer.

## Service Location

**All Services:** `src/shared/services/[serviceName].js`

## Service Structure Rule

Choose the pattern based on whether the service holds state:

| Situation | Pattern |
|---|---|
| Service with no persistent state | Object literal |
| Service that holds state (cache, timers, counters) | Class with instance, exported as singleton |
| Helper / utility file (`*Helpers.js`) | Plain exported functions |

**Never use a class with only static methods.** A static-only class is functionally identical to an object literal but adds class syntax overhead with no benefit.

### Stateless service — object literal (most services)

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
      return result;
    } catch (error) {
      console.error('ServiceName.methodName error:', error);
      throw new Error(`Failed to perform operation: ${error.message}`);
    }
  },
};
```

### Stateful service — class with singleton (rare)

Only use this when the service must hold instance state across calls (e.g. an in-memory cache, a cleanup timer, running counters). See `StrategyCacheService` and `AdaptiveLimitsService` as examples.

```javascript
class ServiceName {
  constructor() {
    this.cache = new Map();
    this.expiry = null;
  }

  async getData(key) { ... }
}

export const serviceName = new ServiceName();
export default serviceName;
```

### Helper file — plain exported functions

Files named `*Helpers.js` export plain functions with no wrapper object. Callers import specific functions by name.

```javascript
export function helperOne(params) { ... }
export function helperTwo(params) { ... }
```

## Best Practices

1. **No static-only classes** - Use object literals instead
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
