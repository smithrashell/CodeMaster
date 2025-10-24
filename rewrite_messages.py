#!/usr/bin/env python3
"""
Script to rewrite commit messages to follow conventional commit format.
Generates commands to run for git filter-branch.
"""

import subprocess
import re

def rewrite_message(msg):
    """Rewrite a commit message to follow conventional commits."""

    # Skip if already has proper scope
    if re.match(r'^(feat|fix|docs|refactor|test|chore)\([^)]+\):', msg):
        return msg

    # Remove batch numbers from refactor messages
    msg = re.sub(
        r'refactor: extract helpers from background/index\.js \(batch \d+/n\)',
        'refactor(background): extract message routing helpers',
        msg
    )

    msg = re.sub(
        r'refactor: reduce complexity in (\w+) \(batch \d+/\d+\)',
        r'refactor(test): reduce complexity in \1',
        msg
    )

    msg = re.sub(
        r'refactor: reduce max-depth in (\w+) \(batch \d+/\d+\)',
        r'refactor(test): reduce max-depth in \1',
        msg
    )

    msg = re.sub(
        r'refactor: reduce max-depth warnings in test functions \(batch \d+/\d+\)',
        'refactor(test): reduce max-depth warnings in test functions',
        msg
    )

    # Fix specific patterns
    if msg.startswith('checkpoint:'):
        msg = re.sub(r'^checkpoint:', 'chore(lint):', msg)

    if msg.startswith('WIP:'):
        return None  # Mark for squashing

    # Add scopes to messages missing them
    if re.match(r'^test: ', msg):
        msg = re.sub(r'^test: update mock', 'test(mock): update mock', msg)
        msg = re.sub(r'^test: fix', 'test(fix): fix', msg)
        msg = re.sub(r'^test: add', 'test(unit): add', msg)

    if re.match(r'^chore: ', msg) and '(config)' not in msg:
        if 'manifest' in msg:
            msg = re.sub(r'^chore:', 'chore(manifest):', msg)
        else:
            msg = re.sub(r'^chore:', 'chore(config):', msg)

    if re.match(r'^fix: ', msg) and '(' not in msg:
        if 'session' in msg.lower():
            msg = re.sub(r'^fix:', 'fix(session):', msg)
        elif 'problem' in msg.lower():
            msg = re.sub(r'^fix:', 'fix(problem):', msg)
        else:
            msg = re.sub(r'^fix:', 'fix(core):', msg)

    if re.match(r'^refactor: extract', msg) and 'handler' in msg.lower():
        msg = re.sub(r'^refactor:', 'refactor(handler):', msg)

    if re.match(r'^refactor: remove', msg):
        msg = re.sub(r'^refactor:', 'refactor(cleanup):', msg)

    # Clean up redundant text
    msg = re.sub(r' \(Phase \d+\)', '', msg)
    msg = re.sub(r' \(batch \d+/n.*\)', '', msg)

    return msg

def main():
    # Get all commits from base to HEAD
    result = subprocess.run(
        ['git', 'log', '--format=%H|%s', 'dd1b76b..HEAD'],
        capture_output=True,
        text=True
    )

    commits = []
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        hash_val, msg = line.split('|', 1)
        new_msg = rewrite_message(msg)

        if new_msg != msg:
            commits.append((hash_val, msg, new_msg))

    print(f"Found {len(commits)} commits to rewrite:\n")

    for hash_val, old_msg, new_msg in commits[:10]:
        print(f"{hash_val[:7]}")
        print(f"  OLD: {old_msg}")
        print(f"  NEW: {new_msg}")
        print()

if __name__ == '__main__':
    main()
