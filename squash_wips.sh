#!/bin/bash
# Auto-squash WIP commits

export GIT_SEQUENCE_EDITOR="sed -i -e 's/^pick b6a61d5/squash b6a61d5/' -e 's/^pick 4aa7c93/squash 4aa7c93/'"
git rebase -i 245f15a^
