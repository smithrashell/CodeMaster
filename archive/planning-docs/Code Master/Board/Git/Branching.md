For a branch that tackles a **modular refactor of `getOrCreateSession()`**, you should follow a clear and structured naming convention that reflects both the type of change and the area of code affected.

---

### ✅ Recommended Branch Naming Convention

Use this format:

```
refactor/<scope>-<summary>
```

Where:

- `refactor` is the type of change (`feat`, `fix`, `chore`, `refactor`, `test`, etc.)
    
- `<scope>` is the affected module or service (e.g. `session`, `auth`, `ui`)
    
- `<summary>` is a concise description of the purpose or goal
    

---

### 🔧 Suggested Branch Name for Your Case

Since this is a modular refactor of `getOrCreateSession()` in the session flow:

```
refactor/session-orchestrator
```

Other good options:

- `refactor/session-entrypoint`
    
- `refactor/session-getorcreate`
    
- `refactor/session-decompose`
    
- `refactor/session-controller-cleanup`
    

All of these are readable, scoped, and descriptive enough for team use or solo work.

---

### 🔁 Optional Enhancements

If you’re working on multiple parallel session refactors:

```
refactor/session-orchestrator-v2
refactor/session-resume-logic
refactor/session-helpers
```

Or if this maps directly to a GitHub issue:

```
refactor/session-orchestrator-#4
```

This keeps things traceable.

---

Let me know if you want a matching PR title + commit prefix too.