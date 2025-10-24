#!/usr/bin/env python3
"""Message filter for git filter-branch."""
import sys
import re

def get_scope_from_message(msg):
    """Determine appropriate scope based on commit message content."""
    msg_lower = msg.lower()

    if 'test' in msg or 'jest' in msg_lower or 'mock' in msg_lower:
        return 'test'
    if 'session' in msg_lower:
        return 'session'
    if 'problem' in msg_lower:
        return 'problem'
    if 'background' in msg_lower or 'handler' in msg_lower:
        return 'background'
    if 'lint' in msg_lower or 'eslint' in msg_lower:
        return 'lint'
    if 'database' in msg_lower or 'db' in msg_lower:
        return 'database'
    if 'ui' in msg_lower or 'component' in msg_lower:
        return 'ui'
    if 'dashboard' in msg_lower or 'analytics' in msg_lower:
        return 'dashboard'
    if 'hint' in msg_lower:
        return 'hint'
    if 'manifest' in msg_lower:
        return 'manifest'
    if 'onboarding' in msg_lower:
        return 'onboarding'
    if 'ci' in msg_lower or 'workflow' in msg_lower:
        return 'ci'
    if 'doc' in msg_lower:
        return 'docs'
    return 'core'

def rewrite_message(msg):
    """Rewrite message to conventional format."""
    # Already has proper scope
    if re.match(r'^(feat|fix|docs|refactor|test|chore|perf|revert|debug|ci)\([^)]+\):', msg):
        return msg

    # Keep merge commits as-is
    if msg.startswith('Merge'):
        return msg

    # Handle Revert commits (capital R)
    if msg.startswith('Revert "'):
        # Extract what's being reverted
        inner = msg[8:-1] if msg.endswith('"') else msg[8:]
        scope = get_scope_from_message(inner)
        return f"revert({scope}): {msg[8:]}"

    # Handle WIP commits
    if msg.startswith('WIP:'):
        description = msg[4:].strip()  # Remove "WIP: " prefix
        scope = get_scope_from_message(description)
        # Convert WIP to chore with descriptive message
        return f"chore({scope}): {description}"

    # Handle checkpoint
    if msg.startswith('checkpoint:'):
        scope = get_scope_from_message(msg)
        return msg.replace('checkpoint:', f'chore({scope}):')

    # Handle debug, revert, ci without scopes
    for prefix in ['debug:', 'revert:', 'ci:']:
        if msg.startswith(prefix):
            description = msg[len(prefix):].strip()
            scope = get_scope_from_message(description)
            commit_type = prefix[:-1]  # Remove colon
            return f"{commit_type}({scope}): {description}"

    # Extract type
    match = re.match(r'^(feat|fix|docs|refactor|test|chore|perf): (.+)', msg)
    if not match:
        return msg

    commit_type, description = match.groups()
    scope = get_scope_from_message(description)

    # Clean up description
    description = re.sub(r' \(batch \d+/\d+\)', '', description)
    description = re.sub(r' \(batch \d+/n.*?\)', '', description)
    description = re.sub(r' - Phase \d+.*$', '', description)
    description = re.sub(r' \(Phase \d+\)', '', description)

    if 'extract helpers from background/index.js' in description:
        description = 'extract message routing helpers'

    return f"{commit_type}({scope}): {description}"

if __name__ == '__main__':
    msg = sys.stdin.read().strip()
    # Only keep the first line (subject) - remove any body/extended description
    first_line = msg.split('\n')[0]
    print(rewrite_message(first_line))
