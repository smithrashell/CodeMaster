# Naming Conventions

This document establishes consistent naming standards for the CodeMaster project to ensure maintainability and developer experience.

## File Naming Standards

### React Components (.jsx files)
- **Use PascalCase** for all React component files
- Component names should be descriptive and match their primary purpose
- Examples:
  - ✅ `TimerComponent.jsx`
  - ✅ `ProblemDetail.jsx`
  - ✅ `MasteryDashboard.jsx`
  - ❌ `timercomponent.jsx`
  - ❌ `probdetail.jsx`

### Pages & Routes
- **Component files**: Use PascalCase (same as components)
- **Route URLs**: Preserve existing URL structure for compatibility
- Content routes (LeetCode overlay): `/Probtime`, `/Probstat`, `/Probgen`
- Dashboard routes: Use kebab-case for multi-word (`/learning-progress`)

### Services & Utilities (.js files)
- **Use camelCase** for all service and utility files
- Examples:
  - ✅ `sessionService.js`
  - ✅ `dashboardService.js`
  - ✅ `utils.js`
  - ❌ `Utils.js`
  - ❌ `SessionService.js`

### CSS & Styling
- **CSS Modules**: Use kebab-case matching component name
  - `TimerComponent.module.css`
  - `ProblemDetail.module.css`
- **Regular CSS**: Use kebab-case
  - `main.css`
  - `theme.css`

### Database & Data Files
- **Use snake_case** for database-related files (existing pattern)
- Examples:
  - `standard_problems.js`
  - `tag_mastery.js`
  - `session_analytics.js`

## Directory Structure Guidelines

### Components Organization
```
src/
├── app/components/          # Dashboard app components (PascalCase)
├── content/components/      # Content script components (PascalCase)
├── shared/components/       # Shared components (PascalCase)
```

### Features Organization
```
src/
├── app/pages/              # Dashboard pages (kebab-case for multi-word)
├── content/features/       # Content script features (PascalCase)
```

## Import Statement Standards

- Always use relative imports for local files
- Keep imports organized: external packages first, then local imports
- Update import paths when renaming files

```javascript
// ✅ Good
import React from "react";
import { useNavigate } from "react-router-dom";
import ProblemDetail from "./ProblemDetail";
import { sessionService } from "../../services/sessionService";

// ❌ Avoid
import probdetail from "./probdetail";
import { SessionService } from "../../services/SessionService";
```

## Future Development Guidelines

### When Creating New Files
1. **Components**: Always use PascalCase
2. **Services**: Always use camelCase  
3. **Pages**: Use PascalCase for files, preserve URL structure
4. **Utilities**: Use camelCase
5. **Tests**: Match the file being tested + `.test.js`

### When Renaming Existing Files
1. Update the filename
2. Update all import statements
3. Test build process (`npm run build`)
4. Test affected routes/functionality
5. Commit changes in logical groups

### Route Considerations
- **Content routes**: Keep existing URLs (`/Probtime`) for LeetCode overlay compatibility
- **Dashboard routes**: Use kebab-case for new multi-word routes (`/session-history`)
- **Single word routes**: Use lowercase (`/settings`)

## ESLint & Code Quality
All naming changes must:
- Pass ESLint checks (`npm run lint`)
- Follow existing code patterns in each file
- Maintain import correctness
- Preserve functionality

---

*This document should be updated when new patterns emerge or conventions change.*