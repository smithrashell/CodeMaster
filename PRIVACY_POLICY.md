# Privacy Policy for CodeMaster

**Last Updated:** November 14, 2025

## Introduction

CodeMaster ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use the CodeMaster Chrome Extension.

**Key Points:**
- ✅ All data is stored locally on your device
- ✅ No data is transmitted to external servers
- ✅ No user tracking or analytics collection
- ✅ No personal information required
- ✅ You maintain full control over your data

## Information We Collect

CodeMaster collects and stores the following information **locally on your device only**:

### 1. Problem Solving Data
- **LeetCode problems attempted** - problem titles, IDs, difficulty levels, tags
- **Attempt history** - timestamps, success/failure status, time spent
- **Performance metrics** - accuracy rates, hints used, perceived difficulty
- **Personal notes and comments** - any annotations you add to problems

### 2. Learning Progress Data
- **Spaced repetition metadata** - box levels, review schedules, stability scores
- **Tag mastery tracking** - progress across algorithm patterns (arrays, dynamic programming, etc.)
- **Session history** - problem sets completed, session dates, performance analytics
- **Pattern ladder progression** - difficulty advancement within algorithm categories

### 3. User Preferences
- **Settings and configurations** - session length, difficulty caps, focus areas
- **UI preferences** - theme settings (light/dark mode), notification preferences
- **Learning goals** - weekly targets, focus topics, guardrail settings

### 4. Technical Data
- **Extension state** - active session data, current problem context
- **Database version** - schema version for data migration purposes

## How We Collect Information

CodeMaster collects information in the following ways:

1. **Content Script Integration**: When you visit LeetCode.com, our content script captures problem metadata from the page you're viewing (only when you explicitly submit an attempt through the extension)

2. **User Input**: When you:
   - Mark a problem as solved or failed
   - Add notes or comments
   - Configure settings and preferences
   - Generate learning sessions

3. **Automatic Tracking**:
   - Time spent on problems (using built-in timer)
   - Session completion timestamps
   - Review schedule calculations

## How We Use Your Information

We use the collected information **exclusively on your local device** to:

1. **Personalize Your Learning Experience**
   - Generate adaptive problem sessions based on your performance
   - Calculate optimal review schedules using spaced repetition algorithms
   - Track mastery levels across different algorithm patterns

2. **Provide Analytics and Insights**
   - Display progress dashboards and statistics
   - Show tag mastery visualizations
   - Track learning velocity and retention rates

3. **Optimize Session Difficulty**
   - Adjust problem difficulty based on recent performance
   - Balance review problems with new challenges
   - Apply pattern ladder progression logic

4. **Maintain Learning State**
   - Remember your position in learning paths
   - Preserve attempt history and notes
   - Store session configurations

## Data Storage

### Storage Location
All data is stored **locally on your device** using:
- **IndexedDB** - Primary storage for problems, attempts, sessions, and analytics
- **Chrome Storage API** - User preferences and extension settings

### Storage Details
- Database Name: `CodeMasterDB`
- Database Version: 22
- Primary Data Stores:
  - `problems` - Problem metadata and learning state
  - `attempts` - Individual problem attempt records
  - `sessions` - Learning session history
  - `tag_mastery` - Algorithm pattern mastery tracking
  - `standard_problems` - LeetCode problem database (2000+ problems)
  - `pattern_ladders` - Difficulty progression tracking
  - `hint_interactions` - Hint usage analytics
  - `settings` - User preferences

### Data Retention
- Data persists indefinitely on your device until you:
  - Manually delete it through the extension
  - Clear browser data for the extension
  - Uninstall the extension

## Data Transmission

**CodeMaster DOES NOT transmit any data to external servers.**

- ❌ No cloud storage or backups
- ❌ No analytics or tracking services
- ❌ No third-party integrations
- ❌ No data sharing with other services

**The ONLY network activity:**
- ✅ Loading LeetCode pages (normal browser activity)
- ✅ Reading problem metadata from LeetCode pages you visit (content script integration)

## Third-Party Access

CodeMaster **does not share, sell, or transmit** your data to any third parties.

**LeetCode Integration:**
- The extension reads publicly visible problem information from leetcode.com pages you visit
- No data is sent to LeetCode
- We are not affiliated with or endorsed by LeetCode

## Your Privacy Rights

You have complete control over your data:

### Right to Access
- View all stored data through the extension dashboard
- Export your data (future feature - not currently implemented)

### Right to Deletion
You can delete your data at any time:

1. **Delete Individual Records**
   - Remove specific problem attempts
   - Clear session history
   - Delete notes and comments

2. **Delete All Data**
   - Uninstall the extension (removes all IndexedDB data)
   - Clear Chrome browser data for the extension:
     - Go to `chrome://settings/siteData`
     - Search for "CodeMaster"
     - Click "Remove all shown"

3. **Reset to Defaults**
   - Reset settings through extension options
   - Clear learning progress while keeping problem database

### Right to Modify
- Edit problem notes and comments
- Update preferences and settings
- Adjust learning goals

## Data Security

Since all data is stored locally on your device:

1. **Your Device Security = Your Data Security**
   - Data is protected by your browser's built-in security
   - IndexedDB data is isolated per browser profile
   - No transmission means no interception risk

2. **Browser Isolation**
   - Data cannot be accessed by other websites
   - Data cannot be accessed by other extensions (unless they have explicit permissions)
   - Data is sandboxed within Chrome's security model

3. **No Account System**
   - No passwords to leak
   - No authentication vulnerabilities
   - No server-side breaches possible

## Permissions Explanation

CodeMaster requires the following Chrome permissions:

| Permission | Purpose | Privacy Impact |
|------------|---------|----------------|
| `storage` | Store learning data locally | Local only, no transmission |
| `tabs` | Detect LeetCode page navigation | Read-only URL checking |
| `activeTab` | Inject content script on LeetCode | Only on user-visited pages |
| `scripting` | Add timer and tracking UI to LeetCode | Visual overlay only |
| `notifications` | Show review reminders (optional) | Local notifications only |
| `alarms` | Schedule review notifications | Local scheduling only |
| `host_permissions: leetcode.com` | Access LeetCode page content | Read problem metadata only |

**We do NOT request:**
- ❌ Access to all websites (only leetcode.com)
- ❌ Network/fetch permissions for external APIs
- ❌ Cookie access
- ❌ History access
- ❌ Downloads permissions

## Children's Privacy

CodeMaster does not knowingly collect information from children under 13. The extension is designed for developers and students learning algorithms, typically 16+. Since all data is stored locally and no personal information is required, there are no special privacy concerns for younger users.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Changes will be reflected in:
- The "Last Updated" date at the top of this policy
- Chrome Web Store listing update notes
- Extension update changelog

**Continued use of the extension after updates constitutes acceptance of the new policy.**

## Data Portability

Currently, CodeMaster does not offer built-in data export functionality. However, as a technical user, you can:

1. Access IndexedDB directly via Chrome DevTools
2. Use browser extensions to export IndexedDB data
3. Request a data export feature (please open a GitHub issue)

**Future feature:** We plan to add a "Export Learning Data" feature in version 1.1+

## Contact Information

If you have questions about this Privacy Policy or data practices:

- **GitHub Issues**: [https://github.com/smithrashell/CodeMaster/issues](https://github.com/smithrashell/CodeMaster/issues)
- **Email**: RashellSSmith@gmail.com
- **Developer**: Rashell Smith

## Compliance

This Privacy Policy complies with:
- ✅ Chrome Web Store Developer Program Policies
- ✅ Google API Services User Data Policy
- ✅ GDPR principles (local storage, user control, transparency)
- ✅ CCPA principles (user rights, no sale of data)

**Note**: Since we don't collect or transmit personal data, many privacy regulations don't apply. However, we follow best practices for transparency and user control.

## Legal Disclaimer

CodeMaster is provided "as is" without warranties. We are not responsible for:
- Data loss due to browser issues, device failure, or user error
- Compatibility issues with LeetCode website changes
- Learning outcomes or interview preparation results

**Recommendation**: While data is stored locally, we recommend:
- Regular device backups if your learning data is valuable
- Exporting data before major Chrome updates
- Testing the extension on non-critical data first

---

**Summary**: CodeMaster is a privacy-first extension. All your data stays on your device, under your control. We don't collect, transmit, or sell anything. Your learning journey is yours alone.
