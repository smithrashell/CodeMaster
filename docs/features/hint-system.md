# 💡 Enhanced Hint System

**Status:** 🚧 Documentation In Progress

Contextual hint system providing algorithm strategy hints with usage analytics.

## Overview

The hint system provides progressive hints based on problem tags, tracks usage patterns, and helps users learn problem-solving strategies.

## Components

**Location:** `chrome-extension-app/src/content/components/strategy/`

- `FloatingHintButton.jsx` - Hint button overlay
- `HintPanel.jsx` - Hint display panel

## Services

**Location:** `chrome-extension-app/src/shared/services/`

- `strategyService.js` - Hint content and strategy management
- `HintInteractionService.js` - Hint usage tracking and analytics

## Features

- Tag-based contextual hints
- Progressive hint disclosure
- Usage analytics and tracking
- Strategy primers and examples
- Integration with learning analytics

## Data

**Hint Content:** `chrome-extension-app/src/shared/constants/strategy_data.js`

Contains algorithm strategies, hints, and primers for 50+ tags.

---

**Related Documentation:**
- [Strategy Service API](../api/services-api.md)
- [Project Structure](../architecture/project-structure.md)

**Last Updated:** 2025-10-25
