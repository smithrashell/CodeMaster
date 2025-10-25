# 🎯 Onboarding System

**Status:** 🚧 Documentation In Progress

User onboarding system providing guided tours for new users on LeetCode pages and dashboard.

## Overview

The onboarding system helps new users understand CodeMaster features through interactive, page-specific tours.

## Components

**Location:** `chrome-extension-app/src/content/components/onboarding/`

- `ContentOnboardingTour.jsx` - Main tour component
- `ElementHighlighter.jsx` - UI element highlighting
- `PageSpecificTour.jsx` - Page-specific tour logic
- `pageTourConfigs.js` - Tour step configurations

## Service

**Location:** `chrome-extension-app/src/shared/services/onboardingService.js`

Manages onboarding state, progress tracking, and tour completion.

## Features

- Page-specific guided tours
- Interactive element highlighting
- Progress tracking
- Skip/complete functionality
- Context-aware database access

## Usage

Tours automatically trigger for new users when visiting LeetCode problem pages.

---

**Related Documentation:**
- [Project Structure](../architecture/project-structure.md#src/content/components/onboarding)
- [Component Development Guide](../guides/component-development.md)

**Last Updated:** 2025-10-25
