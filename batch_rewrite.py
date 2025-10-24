#!/usr/bin/env python3
"""
Generate rewritten commit messages for batch processing.
"""

import subprocess
import re
import sys

def get_scope_from_message(msg):
    """Determine appropriate scope based on commit message content."""
    msg_lower = msg.lower()

    # Check for specific keywords
    if 'test' in msg or 'jest' in msg_lower or 'mock' in msg_lower:
        if 'mock' in msg_lower:
            return 'test-mock'
        return 'test'

    if 'session' in msg_lower:
        return 'session'

    if 'problem' in msg_lower:
        return 'problem'

    if 'background' in msg_lower or 'handler' in msg_lower:
        return 'background'

    if 'lint' in msg_lower or 'eslint' in msg_lower:
        return 'lint'

    if 'database' in msg_lower or 'indexeddb' in msg_lower or 'db' in msg_lower:
        return 'database'

    if 'ui' in msg_lower or 'component' in msg_lower or 'css' in msg_lower:
        return 'ui'

    if 'analytics' in msg_lower or 'dashboard' in msg_lower:
        return 'dashboard'

    if 'hint' in msg_lower:
        return 'hint'

    if 'manifest' in msg_lower:
        return 'manifest'

    if 'onboarding' in msg_lower:
        return 'onboarding'

    if 'ci' in msg_lower or 'workflow' in msg_lower:
        return 'ci'

    if 'doc' in msg_lower or 'readme' in msg_lower:
        return 'docs'

    # Default scopes by type
    return 'core'

def rewrite_message(msg):
    """Rewrite a commit message to follow conventional commits."""
    original = msg

    # Already has proper scope
    if re.match(r'^(feat|fix|docs|refactor|test|chore|perf)\([^)]+\):', msg):
        return msg, False

    # Handle WIP commits - mark for squashing
    if msg.startswith('WIP:'):
        return f"# SQUASH THIS: {msg}", True

    # Handle checkpoint commits
    if msg.startswith('checkpoint:'):
        scope = get_scope_from_message(msg)
        msg = msg.replace('checkpoint:', f'chore({scope}):')
        return msg, True

    # Handle merge commits - keep as is
    if msg.startswith('Merge pull request') or msg.startswith('Merge branch'):
        return msg, False

    # Extract type
    match = re.match(r'^(feat|fix|docs|refactor|test|chore|perf): (.+)', msg)
    if not match:
        # Not a conventional commit at all
        return msg, False

    commit_type, description = match.groups()

    # Get appropriate scope
    scope = get_scope_from_message(description)

    # Remove batch/phase markers
    description = re.sub(r' \(batch \d+/\d+\)', '', description)
    description = re.sub(r' \(batch \d+/n.*?\)', '', description)
    description = re.sub(r' - Phase \d+.*$', '', description)
    description = re.sub(r' \(Phase \d+\)', '', description)

    # Simplify repetitive descriptions
    if 'extract helpers from background/index.js' in description:
        description = 'extract message routing helpers'

    if re.match(r'reduce complexity in \w+', description):
        func_name = re.search(r'reduce complexity in (\w+)', description).group(1)
        description = f'reduce complexity in {func_name}'

    # Construct new message
    new_msg = f"{commit_type}({scope}): {description}"

    return new_msg, (new_msg != original)

def process_batch(start_commit, end_commit):
    """Process a batch of commits and generate rewrite commands."""
    # Get commits in range
    cmd = ['git', 'log', '--format=%H|%s', f'{start_commit}^..{end_commit}']
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)

    rewrites = []
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        hash_val, msg = line.split('|', 1)
        new_msg, changed = rewrite_message(msg)

        if changed:
            rewrites.append({
                'hash': hash_val,
                'old': msg,
                'new': new_msg
            })

    return rewrites

def main():
    if len(sys.argv) != 3:
        print("Usage: python batch_rewrite.py <start_commit> <end_commit>")
        sys.exit(1)

    start = sys.argv[1]
    end = sys.argv[2]

    rewrites = process_batch(start, end)

    print(f"Found {len(rewrites)} commits to rewrite in this batch:\n")

    for r in rewrites[:20]:  # Show first 20
        print(f"{r['hash'][:7]}")
        print(f"  OLD: {r['old']}")
        print(f"  NEW: {r['new']}")
        print()

    if len(rewrites) > 20:
        print(f"... and {len(rewrites) - 20} more")

    # Generate the rebase command
    print("\n" + "="*60)
    print("To apply these changes, use:")
    print(f"git rebase -i {start}^")
    print("\nThen change 'pick' to 'reword' for each commit you want to update.")

if __name__ == '__main__':
    main()
