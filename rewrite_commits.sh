#!/bin/bash

# Script to rewrite commit messages to follow conventional commit format

git filter-branch --msg-filter '
    msg="$1"

    # Fix: Remove batch numbers and add scopes
    msg=$(echo "$msg" | sed "s/refactor: extract helpers from background\/index.js (batch [0-9]\/n)/refactor(background): extract message routing helpers/")
    msg=$(echo "$msg" | sed "s/refactor: reduce complexity in \([^(]*\) (batch [0-9]*\/40)/refactor(test): reduce complexity in \1/")
    msg=$(echo "$msg" | sed "s/refactor: reduce max-depth in \([^(]*\) (batch [0-9]*\/[0-9]*)/refactor(test): reduce max-depth in \1/")
    msg=$(echo "$msg" | sed "s/refactor: reduce max-depth warnings in test functions (batch [0-9]*\/[0-9]*)/refactor(test): reduce max-depth warnings in test functions/")

    # Add scopes where missing
    msg=$(echo "$msg" | sed "s/^test: /test(unit): /")
    msg=$(echo "$msg" | sed "s/^chore: /chore(config): /")
    msg=$(echo "$msg" | sed "s/^fix: /fix(core): /")

    echo "$msg"
' -- dd1b76b..HEAD
