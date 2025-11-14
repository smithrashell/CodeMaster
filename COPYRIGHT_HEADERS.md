# Copyright Header Templates

Use these headers at the top of new source files. For existing files, headers can be added gradually.

## JavaScript/TypeScript Files

```javascript
/**
 * CodeMaster - Algorithm Learning Assistant
 * Copyright (C) 2025 Rashell Smith
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
```

## CSS Files

```css
/**
 * CodeMaster - Algorithm Learning Assistant
 * Copyright (C) 2025 Rashell Smith
 * Licensed under GNU AGPL v3 - see LICENSE file
 */
```

## JSON Files (Compact Comment)

```json
{
  "_license": "CodeMaster - Copyright (C) 2025 Rashell Smith - Licensed under GNU AGPL v3",
  ...
}
```

## Markdown Files

```markdown
<!--
CodeMaster - Algorithm Learning Assistant
Copyright (C) 2025 Rashell Smith
Licensed under GNU AGPL v3 - see LICENSE file
-->
```

## Shell Scripts

```bash
#!/bin/bash
#
# CodeMaster - Algorithm Learning Assistant
# Copyright (C) 2025 Rashell Smith
# Licensed under GNU AGPL v3 - see LICENSE file
#
```

## When to Add Headers

### Required
- ✅ New files you create
- ✅ Files you substantially modify (50%+ changes)

### Optional
- Files with only minor edits
- Third-party library files (keep their original licenses)
- Auto-generated files (webpack config, build outputs)

## Copyright Year Guidelines

- **New files in 2025**: `Copyright (C) 2025`
- **Modified existing files**: `Copyright (C) 2025` (update year)
- **Files created earlier**: Keep original year or update to current

## Dual Licensing Note (Optional)

If you plan to offer commercial licenses, you can add this below the AGPL header:

```javascript
/**
 * CodeMaster - Algorithm Learning Assistant
 * Copyright (C) 2025 Rashell Smith
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Alternative commercial licensing is available. For commercial licensing
 * terms, please contact: RashellSSmith@gmail.com
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
```

## Automated Header Addition

You can use tools like `license-header` or write a script to batch-add headers:

```bash
# Example: Add header to all .js files missing it
find chrome-extension-app/src -name "*.js" ! -path "*/node_modules/*" -exec sh -c '
  if ! grep -q "GNU Affero General Public License" "$1"; then
    echo "Adding header to $1"
    cat COPYRIGHT_HEADER.txt "$1" > "$1.tmp" && mv "$1.tmp" "$1"
  fi
' _ {} \;
```

## Third-Party Code

If you incorporate third-party code:
1. Keep their original license header
2. Add a THIRD_PARTY_LICENSES.md file listing all dependencies
3. Ensure compatibility with AGPL v3 (most permissive licenses like MIT, BSD are compatible)

**Incompatible licenses to avoid:**
- Proprietary/closed-source libraries
- Some GPL v2-only code (without "or later" clause)
- Licenses with advertising clauses

## Contributors' Code

All contributor code automatically becomes AGPL v3 (via CLA in CONTRIBUTING.md):
- Contributors grant you copyright assignment OR
- Contributors grant broad license to relicense (dual licensing)

This allows you to:
- Relicense under commercial terms
- Enforce copyright on violations
- Change license in future if needed
