#!/usr/bin/env bash
# Setup script to configure git hooks for this repository

echo "🔧 Setting up git hooks..."

# Configure git to use .githooks directory
git config core.hooksPath .githooks

echo "✅ Git hooks configured successfully!"
echo ""
echo "The following hooks are now active:"
echo "  - commit-msg: Enforces single-line commit messages"
echo ""
echo "To disable: git config --unset core.hooksPath"
