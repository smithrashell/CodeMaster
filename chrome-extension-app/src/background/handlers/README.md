# Background Message Handlers

Each file in this directory handles a slice of Chrome runtime messages routed by `messageRouter.js`.

---

## Handler Pattern

Choose based on handler complexity, not consistency for its own sake.

### Pattern A — named functions + registry

Use when handlers have **database operations, async branching, or multi-step logic**.

Named functions appear in stack traces, can be imported individually for testing, and keep complex logic readable as standalone units.

```js
export function handleGetSession(request, _dependencies, sendResponse, finishRequest) {
  // complex logic here
}

export const sessionHandlers = {
  'getSession': handleGetSession,
};
```

Used by: `sessionHandlers`, `problemHandlers`, `onboardingHandlers`

### Pattern B — logic inline in the registry object

Use when handlers are **short and read from static or JSON data**.

Co-location of the message key and its implementation is a genuine win when the body is simple enough to read at a glance.

```js
export const strategyHandlers = {
  getStrategyForTag: (request, _dependencies, sendResponse, finishRequest) => {
    // simple lookup
  },
};
```

Used by: `strategyHandlers`, `hintHandlers`

---

## Handler Signature

All handlers receive four positional arguments:

```js
function handleX(request, _dependencies, sendResponse, finishRequest)
```

| Argument | Description |
|---|---|
| `request` | The incoming Chrome message object |
| `_dependencies` | Injected by messageRouter — unused in most handlers, prefix with `_` |
| `sendResponse` | Call once to send the response back to the caller |
| `finishRequest` | Call in `.finally()` to release the message channel |

Always `return true` to signal that the response will be sent asynchronously.

---

## Response Shape

**Errors** — all handlers use the same shape so callers check one field:

```js
sendResponse({ error: "message string" });
```

**Success** — domain-specific. Return whatever the caller needs:

```js
sendResponse({ session });           // sessionHandlers
sendResponse({ success: true, data });  // when an explicit ack is needed
sendResponse({ success: true, ...r });  // spread when passing through a service result
```

The `ChromeAPIErrorHandler` infrastructure detects `response.error` and surfaces it as a thrown exception, so callers using `sendMessageWithRetry` never need to check `response.error` themselves — it is handled for them.

---


