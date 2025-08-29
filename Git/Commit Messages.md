Here’s an **updated commit message guide tailored to your existing style** — preserving your natural voice while incorporating industry best practices for clarity and consistency.

---

## ✅ Codemaster Commit Message Guide

### 🔹 Format

```
<type>(<optional-scope>): <short summary in sentence case>

<optional: bullet list of key changes for clarity>
```

---

### 🧩 Acceptable `<type>` options

| Type       | Purpose                                                           |
| ---------- | ----------------------------------------------------------------- |
| `feat`     | New user-facing features                                          |
| `fix`      | Bug fixes                                                         |
| `refactor` | Code restructuring with no behavior change (e.g., modularization) |
| `chore`    | Build/infra/tooling changes (e.g., CI, linting, deps)             |
| `docs`     | Documentation updates                                             |
| `style`    | Formatting, whitespace, minor CSS                                 |
| `test`     | For adding or updating tests                                      |
 
---

### 🪛 Example Commit Messages Based on Your History

#### 🧠 Logical & Clean Refactor

```bash
refactor(core): modularize session logic and migrate settings to IndexedDB

- Extracted resumeSession() for continuing partial sessions
- Created createNewSession() to isolate session initialization
- Refactored getOrCreateSession() as orchestrator for lifecycle management
```

---

#### 🧰 Tooling / CI

```bash
chore: add lockfile for consistent CI builds
```

```bash
chore: update main.yml and package.json for relaxed CI rules during development
```

---

#### 🧱 Feature/Infra Update

```bash
feat: major dashboard + UI upgrade, adaptive session toggle, tag mastery components
```

---

#### 🧹 Simple One-Liners

```bash
Update README.md
Update main.yml
Create main.yml
```

These are okay for small, isolated changes (e.g. a single file edit). For longer-term consistency, prefer full `type(scope): summary` format.

---

## ✅ Commit Summary Style Tips

|Principle|Do This|
|---|---|
|🎯 **Be clear**|Use plain language, e.g., `refactor session logic` not `revamp SL meta`|
|🧩 **Be structured**|Bullet list for PRs or grouped logic changes|
|📦 **Use scope**|`(core)`, `(db)`, `(session)`, `(chrome)` — helpful for searchability|
|🧪 **Be testable**|If it adds or changes behavior, consider how it could be verified|

---

## 🧵 Optional Pull Request Title Convention

```
refactor(session): modularize getOrCreateSession() into orchestrator + helpers
```

> Then use the PR **description** for deeper explanation.

---

Let me know if you want a `.commitlintrc` or Husky pre-commit hook setup to enforce these conventions automatically in your workflow.