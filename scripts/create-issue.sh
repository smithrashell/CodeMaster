#!/bin/bash
# GitHub Issue Creation Helper
# Uses CodeMaster guidelines and templates

echo "🎯 CodeMaster Issue Creator"
echo ""
echo "Select issue type:"
echo "1) 🐛 Bug Report"
echo "2) ✨ Feature Request"
echo "3) 🔄 Refactor"
echo "4) 📝 Documentation"
echo "5) 🧪 Testing"
echo "6) 🧹 Chore"
echo ""
read -p "Choice (1-6): " choice

case $choice in
  1)
    TYPE="fix"
    LABEL="bug"
    TEMPLATE="bug_report"
    ;;
  2)
    TYPE="feat"
    LABEL="enhancement"
    TEMPLATE="feature_request"
    ;;
  3)
    TYPE="refactor"
    LABEL="refactor"
    TEMPLATE="refactor"
    ;;
  4)
    TYPE="docs"
    LABEL="documentation"
    TEMPLATE="ISSUE_TEMPLATE"
    ;;
  5)
    TYPE="test"
    LABEL="testing"
    TEMPLATE="ISSUE_TEMPLATE"
    ;;
  6)
    TYPE="chore"
    LABEL="chore"
    TEMPLATE="ISSUE_TEMPLATE"
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
read -p "Issue title (without type prefix): " TITLE

echo ""
echo "Creating issue with:"
echo "  Type: $TYPE"
echo "  Title: $TYPE: $TITLE"
echo "  Label: $LABEL"
echo "  Template: $TEMPLATE"
echo ""

# Open in browser with template
gh issue create \
  --title "$TYPE: $TITLE" \
  --label "$LABEL" \
  --web

echo "✅ Opening GitHub in browser with template..."
