# Git Hooks

This directory contains git hooks for the CodeMaster repository.

## Setup

To enable the hooks, run:

```bash
.githooks/setup.sh
```

Or manually configure git:

```bash
git config core.hooksPath .githooks
```

## Active Hooks

### commit-msg

Enforces single-line commit messages following the conventional commit format.

**Format**: `type(scope): description`

**Examples**:
- `fix(goals): remove onboarding badges after session completion`
- `feat(dashboard): add statistics chart for hint usage`
- `refactor(db): simplify session query logic`

**Commit Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Why single-line?**:
- Easier to scan in git log
- Better for automated tools and CI/CD
- Forces concise, focused commits
- Consistent with project standards

## Disabling Hooks

To disable hooks temporarily:

```bash
git commit --no-verify
```

To disable permanently:

```bash
git config --unset core.hooksPath
```
