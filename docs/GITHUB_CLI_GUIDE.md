# 🚀 GitHub CLI Guide for CodeMaster

This guide shows how to use the GitHub CLI (`gh`) with CodeMaster's templates and guidelines.

---

## 📋 Quick Reference

### Creating Issues

#### Option 1: Interactive (Recommended)
```bash
# Opens browser with template selection
gh issue create --web
```

#### Option 2: Use Helper Script
```bash
# Interactive issue creator with templates
bash scripts/create-issue.sh
```

#### Option 3: Command Line with Template
```bash
# Bug report
gh issue create \
  --title "fix: session race condition" \
  --label "bug" \
  --web

# Feature request
gh issue create \
  --title "feat: tag mastery visualization" \
  --label "enhancement" \
  --web

# Refactor
gh issue create \
  --title "refactor: modularize session logic" \
  --label "refactor" \
  --web
```

---

### Creating Pull Requests

#### Option 1: Interactive (Recommended)
```bash
# Opens browser with PR template
gh pr create --web
```

#### Option 2: Command Line
```bash
# Create PR with template in editor
gh pr create \
  --title "fix(session): resolve race condition" \
  --fill

# This opens your editor with the PR template pre-filled
```

#### Option 3: Quick PR
```bash
# For small changes
gh pr create \
  --title "docs: update README" \
  --body "Updates installation instructions" \
  --label "documentation"
```

---

## 🎯 Using Templates

### Available Issue Templates

1. **Bug Report** - `.github/ISSUE_TEMPLATE/bug_report.md`
   ```bash
   gh issue create --template "bug_report" --web
   ```

2. **Feature Request** - `.github/ISSUE_TEMPLATE/feature_request.md`
   ```bash
   gh issue create --template "feature_request" --web
   ```

3. **Refactor** - `.github/ISSUE_TEMPLATE/refactor.md`
   ```bash
   gh issue create --template "refactor" --web
   ```

4. **General Issue** - `.github/ISSUE_TEMPLATE.md`
   ```bash
   gh issue create --web
   ```

### Pull Request Template

The PR template at `.github/PULL_REQUEST_TEMPLATE.md` is automatically loaded when you create a PR:

```bash
gh pr create --web
```

---

## 🔄 Complete Workflow Example

### 1. Create an Issue

```bash
# Open browser with bug report template
gh issue create --template "bug_report" --web

# Fill out the template in GitHub UI
# Issue #123 is created
```

### 2. Create a Branch

```bash
# Follow branching guidelines
git checkout -b fix/session-race-condition-123
```

### 3. Make Changes

```bash
# Write code
# Commit following commit guidelines
git commit -m "fix(session): implement lock to prevent concurrent session creation"
```

### 4. Create Pull Request

```bash
# Push branch
git push origin fix/session-race-condition-123

# Create PR with template
gh pr create --web

# Or use CLI
gh pr create \
  --title "fix(session): resolve race condition in concurrent session creation" \
  --fill
```

---

## 💡 Pro Tips

### 1. Set Default Editor

```bash
# Use your preferred editor for issue/PR bodies
gh config set editor "code --wait"  # VS Code
gh config set editor "vim"           # Vim
gh config set editor "nano"          # Nano
```

### 2. View Templates Before Creating

```bash
# List available templates
ls -la .github/ISSUE_TEMPLATE/

# Preview a template
cat .github/ISSUE_TEMPLATE/bug_report.md
```

### 3. Create Draft PRs

```bash
# Create draft PR for work in progress
gh pr create --draft --web
```

### 4. Link Issues to PRs

```bash
# In PR body, use keywords:
# "Closes #123"
# "Fixes #456"
# "Related to #789"
```

### 5. Add Labels Quickly

```bash
# Common CodeMaster labels
gh issue create \
  --label "bug,priority:high" \
  --web

gh pr create \
  --label "enhancement,needs-review" \
  --web
```

---

## 🏷️ Common Labels

| Label | Purpose |
|-------|---------|
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `refactor` | Code improvement without behavior change |
| `documentation` | Improvements or additions to docs |
| `testing` | Adding or improving tests |
| `chore` | Maintenance tasks |
| `priority:high` | Needs immediate attention |
| `priority:low` | Can be addressed later |
| `good-first-issue` | Good for newcomers |
| `needs-review` | Requires code review |
| `blocked` | Cannot proceed without something else |

---

## 📚 Following the Guidelines

When creating issues or PRs with `gh`, always reference:

- **[Branching Guidelines](BRANCHING_GUIDELINES.md)** - Branch naming
- **[Commit Guidelines](COMMIT_GUIDELINES.md)** - Commit messages
- **[Contributing Guide](../CONTRIBUTING.md)** - Overall workflow

---

## 🔧 Troubleshooting

### Template Not Showing Up

If templates don't appear:

1. Make sure you're in the repository root
2. Use `--web` flag to open in browser
3. Check templates exist: `ls .github/ISSUE_TEMPLATE/`

### Authentication Issues

```bash
# Check authentication status
gh auth status

# Login if needed
gh auth login
```

### Can't Find Repository

```bash
# Set repository explicitly
gh repo set-default smithrashell/CodeMaster

# Or use -R flag
gh issue create -R smithrashell/CodeMaster --web
```

---

## 📖 Additional Resources

- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GitHub CLI Reference](https://cli.github.com/manual/gh)
- [GitHub Templates Documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests)

---

**Remember**: Using `--web` flag opens templates in your browser where you can fill them out interactively!
