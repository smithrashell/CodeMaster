# 🌿 CodeMaster Branching Guidelines

This guide provides branch naming conventions and workflow recommendations for the CodeMaster project.

---

## ✅ Branch Naming Convention

Use this format for all branches:

```
<type>/<scope>-<summary>-<issue#>
```

**Where:**
- `<type>` is the type of change (feat, fix, chore, refactor, test, docs)
- `<scope>` is the affected module or service (e.g., session, auth, ui, db)
- `<summary>` is a concise description of the purpose or goal
- `<issue#>` (optional but recommended) is the GitHub issue number

---

## 🔧 Branch Type Prefixes

| Prefix     | Purpose                                    | Example                                    |
|------------|--------------------------------------------|--------------------------------------------|
| `feat/`    | New features                               | `feat/tag-mastery-visualization-45`        |
| `fix/`     | Bug fixes                                  | `fix/session-race-condition-123`           |
| `refactor/`| Code restructuring (no behavior change)    | `refactor/session-orchestrator-67`         |
| `chore/`   | Build/tooling/maintenance                  | `chore/remove-frontend-directory-143`      |
| `docs/`    | Documentation updates                      | `docs/update-setup-guide-89`               |
| `test/`    | Adding or updating tests                   | `test/session-service-coverage-91`         |
| `style/`   | Formatting, CSS, whitespace                | `style/improve-dashboard-layout-12`        |

---

## 📝 Branch Naming Examples

### ✨ Feature Branches

```bash
feat/tag-escape-hatch-45
feat/dashboard-analytics-chart-78
feat/hint-interaction-tracking-92
```

### 🐛 Bug Fix Branches

```bash
fix/session-thresholds-123
fix/database-migration-error-156
fix/timer-component-rerender-201
```

### 🔄 Refactor Branches

```bash
refactor/session-orchestrator-67
refactor/session-entrypoint-68
refactor/modularize-background-script-104
refactor/session-getorcreate-decompose-112
```

### 🧰 Chore Branches

```bash
chore/update-dependencies-55
chore/remove-legacy-gitignore-entries-178
chore/eslint-config-update-203
```

### 📚 Documentation Branches

```bash
docs/update-api-documentation-89
docs/add-architecture-diagrams-145
docs/improve-contributing-guide-167
```

---

## 🔀 Branch Workflow

### 1. Main Branch Protection

- `main` is the production-ready branch
- All changes must go through pull requests
- Requires at least one approval before merge
- All tests must pass

### 2. Creating a New Branch

```bash
# Always start from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feat/new-feature-123
```

### 3. Working on Your Branch

```bash
# Make changes and commit regularly
git add .
git commit -m "feat(scope): descriptive message"

# Push to remote
git push origin feat/new-feature-123
```

### 4. Keeping Your Branch Updated

```bash
# Regularly sync with main
git checkout main
git pull origin main
git checkout feat/new-feature-123
git merge main

# Or use rebase for cleaner history
git rebase main
```

### 5. Creating a Pull Request

Once your work is complete:
1. Push all commits to your branch
2. Create a pull request on GitHub
3. Fill out the PR template completely
4. Request review from maintainers
5. Address any feedback
6. Merge once approved

---

## 🎯 Best Practices

### ✅ Do This

- **Use descriptive names**: `refactor/session-orchestrator-67` not `fix-stuff`
- **Include issue numbers**: Helps track work and provides context
- **Keep branches focused**: One issue/feature per branch
- **Delete after merge**: Clean up merged branches promptly
- **Use consistent naming**: Follow the established pattern

### ❌ Avoid This

- ❌ Generic names like `updates`, `fixes`, `changes`
- ❌ Including developer names: `johns-branch`
- ❌ Dates in branch names: `feature-2024-01-15`
- ❌ Multiple unrelated changes in one branch
- ❌ Long-lived feature branches (merge frequently)

---

## 🔁 Optional Enhancements

### Multiple Related Branches

If you're working on multiple parallel refactors in the same area:

```bash
refactor/session-orchestrator-v2-67
refactor/session-resume-logic-68
refactor/session-helpers-69
```

### Issue Tracking

Direct mapping to GitHub issues:

```bash
fix/session-thresholds-123  # Maps to issue #123
feat/tag-escape-hatch-45    # Maps to issue #45
```

This keeps work traceable and makes it easy to link PRs to issues.

---

## 📊 Branch Lifecycle

```
1. Create branch from main
   ↓
2. Develop and commit
   ↓
3. Push to remote
   ↓
4. Create pull request
   ↓
5. Code review
   ↓
6. Address feedback
   ↓
7. Merge to main
   ↓
8. Delete branch
```

---

## 🚫 Protected Branches

These branches have special protections:

- **`main`**: Production-ready code
  - Requires PR approval
  - Must pass all tests
  - No direct commits

---

## 💡 Tips for Success

1. **Start with an issue** - Create or reference an issue before starting work
2. **Name branches early** - Follow the convention from the start
3. **Keep branches small** - Easier to review and merge
4. **Sync frequently** - Merge main into your branch regularly
5. **Clean up** - Delete merged branches to keep the repository tidy

---

## 📚 Related Documentation

- [Commit Guidelines](COMMIT_GUIDELINES.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Pull Request Template](../.github/PULL_REQUEST_TEMPLATE.md)
- [Issue Template](../.github/ISSUE_TEMPLATE.md)
