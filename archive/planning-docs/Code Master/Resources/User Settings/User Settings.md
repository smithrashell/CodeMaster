# Customizing Your Learning Experience

## What This Does
**The settings page lets you control how CodeMaster creates your study sessions and manages your learning experience.** You can switch between fully automated learning or take manual control over session lengths, timing, and notifications.

## Your Control Options

### 🤖 **Adaptive Sessions Toggle**
**This is the main decision: Let CodeMaster decide, or control it yourself?**

- **Adaptive ON** (Recommended): CodeMaster analyzes your performance and automatically adjusts session lengths, problem counts, and difficulty progression
- **Adaptive OFF** (Manual): You set fixed numbers for session length and how many new problems to include

### ⚙️ **Manual Session Controls** (When Adaptive is OFF)

#### **Session Length Slider**
- **What it controls**: How many total problems you want in each study session
- **Range**: Typically 5-15 problems per session
- **Why it matters**: Longer sessions = more practice but require more time commitment

#### **New Problems Per Session**
- **What it controls**: Out of your total session length, how many should be brand new problems (vs. review problems)
- **Smart limits**: The slider automatically caps at your total session length
- **Example**: If session length is 10, you can choose 1-8 new problems (the rest will be reviews)

### ⏱️ **Time Limits**
**Controls how long you get to work on each problem before the timer suggests moving on.**

- **Auto** (Recommended): CodeMaster sets time limits based on problem difficulty
  - Easy problems: 15 minutes
  - Medium problems: 20 minutes  
  - Hard problems: 30 minutes
- **Manual**: You set your own time limits (coming soon)

### 🔔 **Review Reminders**
**Daily notifications to keep you on track with your coding practice.**

- **Toggle**: Turn daily reminders on/off
- **Time Selection**: Choose what time of day you want to be reminded (24-hour format)
- **How it works**: Uses your browser's notification system to remind you to practice

## How Settings Get Applied

### 🔄 **Real-Time Updates**
Changes you make in settings apply immediately:
- Hit "Save" and your next session will use the new settings
- Settings are stored locally in your browser
- No account or cloud sync needed

### 📊 **Settings Impact on Learning**
- **Adaptive Mode**: CodeMaster optimizes your learning path automatically based on performance data
- **Manual Mode**: You have full control but need to self-regulate difficulty and progression
- **Time Limits**: Help you practice working under pressure (like real coding interviews)
- **Reminders**: Keep you consistent with daily practice habits

## Technical Details

### How Settings Are Stored
Your preferences get saved to Chrome's local storage and persist across browser sessions. The settings structure:

```javascript
{
  adaptive: true/false,           // Main adaptive toggle
  sessionLength: number,          // Manual session size
  numberofNewProblemsPerSession: number, // Manual new problem count
  limit: "Auto",                  // Time limit mode
  reminder: {
    enabled: true/false,          // Daily reminders on/off
    time: "09:00"                 // Reminder time (HH:MM)
  }
}
```

### Integration with Learning System
- **Session Creation**: Settings get passed to the session generation algorithm
- **Background Processing**: Chrome extension uses settings to schedule reminders
- **Adaptive Learning**: When adaptive mode is on, your manual settings become suggestions rather than hard limits

## Recommended Settings

### 🎯 **For Beginners**
- **Adaptive**: ON (let the system guide you)
- **Time Limits**: Auto (learn standard timing expectations)
- **Reminders**: ON at a consistent daily time

### 🔥 **For Advanced Users**
- **Adaptive**: OFF (if you want full control)
- **Manual Sessions**: 8-12 problems with 4-6 new problems
- **Time Limits**: Auto (still good for interview prep)

### 📈 **For Interview Prep**
- **Adaptive**: ON (optimizes for learning patterns quickly)
- **Time Limits**: Auto (practices real interview timing)
- **Reminders**: ON (consistency is key)

## Current Implementation Status
✅ **COMPLETED** - Full settings system implemented in `settings.jsx` with Chrome storage integration

The settings give you the flexibility to customize CodeMaster for your learning style while still benefiting from the intelligent algorithms when you want them.