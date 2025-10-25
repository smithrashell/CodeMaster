# ✅ CodeMaster Commit Message Guidelines

This guide provides commit message standards for the CodeMaster project, preserving clarity and consistency across the codebase.

---

## 🔹 Format

```
<type>(<optional-scope>): <short summary in sentence case>

<optional: bullet list of key changes for clarity>
```

---

## 🧩 Acceptable `<type>` Options

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

## 🪛 Example Commit Messages

### 🧠 Logical & Clean Refactor

```bash
refactor(core): modularize session logic and migrate settings to IndexedDB

- Extracted resumeSession() for continuing partial sessions
- Created createNewSession() to isolate session initialization
- Refactored getOrCreateSession() as orchestrator for lifecycle management
```

---

### 🐛 Bug Fix

```bash
fix(session): resolve race condition in concurrent session creation

- Implemented in-memory lock with timeout to prevent duplicates
- Ensures only one session creation operation runs at a time
```

---

### ✨ New Feature

```bash
feat(dashboard): add tag mastery visualization with interactive charts

- Created LearningPathVisualization component
- Added pan/zoom/drag functionality for network graph
- Integrated with dashboard analytics
```

---

### 🧰 Tooling / CI

```bash
chore: add lockfile for consistent CI builds
```

```bash
chore(ci): update main.yml and package.json for relaxed CI rules during development
```

---

### 📝 Documentation

```bash
docs: update all documentation references from Frontend/ to chrome-extension-app/

- Updated 12 documentation files
- Fixed references in CONTRIBUTING.md, architecture docs, and setup guides
- Added migration note to CHANGELOG
```

---

### 🧹 Simple One-Liners

```bash
Update README.md
Update main.yml
Create main.yml
```

These are okay for small, isolated changes (e.g. a single file edit). For longer-term consistency, prefer full `type(scope): summary` format.

---

## ✅ Commit Summary Style Tips

| Principle | Do This |
|---|---|
| 🎯 **Be clear** | Use plain language, e.g., `refactor session logic` not `revamp SL meta` |
| 🧩 **Be structured** | Bullet list for PRs or grouped logic changes |
| 📦 **Use scope** | `(core)`, `(db)`, `(session)`, `(chrome)` — helpful for searchability |
| 🧪 **Be testable** | If it adds or changes behavior, consider how it could be verified |

---

## 🧵 Pull Request Title Convention

Pull request titles should follow the same format as commit messages:

```
refactor(session): modularize getOrCreateSession() into orchestrator + helpers
```

```
fix(lint): remove unnecessary async keywords from DatabaseProxy methods
```

```
docs: update all documentation references from Frontend/ to chrome-extension-app/
```

---

## 🔀 Branch Naming Convention

Branches should follow this pattern:

```
<type>/<short-slug>-<Issue#>
```

**Examples:**
- `fix/session-thresholds-123`
- `feat/tag-escape-hatch-45`
- `refactor/modularize-session-logic-67`
- `chore/remove-frontend-directory-143`

---

## 💡 Best Practices

1. **Keep commits atomic** - One logical change per commit
2. **Write in imperative mood** - "Add feature" not "Added feature"
3. **Explain the why, not just the what** - In the body, explain why the change was needed
4. **Reference issues** - Use `Closes #123` or `Fixes #123` in commit messages
5. **Keep the summary under 72 characters** - For better git log readability

---

## 🚫 What to Avoid

- ❌ Vague messages like "fix bug" or "update code"
- ❌ Including file names in the summary (git already tracks this)
- ❌ Mixing multiple unrelated changes in one commit
- ❌ Commits that break the build or tests

---

## 📚 Additional Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)
- [CodeMaster Contributing Guidelines](../CONTRIBUTING.md)
