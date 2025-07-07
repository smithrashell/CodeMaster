# 🧠 CodeMaster: Algorithm Mastery Assistant

**CodeMaster** is a personalized learning and productivity Chrome Extension that helps developers master data structures and algorithms through a smart, pattern-based spaced repetition system. It integrates with platforms like LeetCode to track your progress, adapt your sessions, and reinforce long-term retention using the Leitner system and pattern ladders.

---

## 🚀 Key Features

- 🔁 **Leitner System** for spaced repetition of problems using box levels and cooldown logic
- 🧠 FSRS (Forgetting Spaced Repetition Scheduling) support for better long-term retention
- 🧩 **Pattern Ladders** to guide progression through algorithm types with tag-aware difficulty scaling
- 📊 **Dashboard Analytics** with Recharts: tag mastery, box distribution, session trends, and problem activity
- 📈 **Adaptive Sessions** that adjust based on your tag performance, session results, and recent inactivity
- 🧠 **Tag Mastery Engine** tracking ladder completion, problem success rates, and decay scores
- 🧰 **Extension Mode** overlays Codemaster on LeetCode for in-browser problem capturing and annotation

---

## 🔮 Planned Features (v1.1+)

- 🃏 **Flashcard Mode** for reinforced learning based on recent sessions and failed problems 
- 🤖 **ChatGPT-powered flashcard generation** using user notes and problem tags
- 🎮 Gamified elements (XP, badges, streaks)


---
## 📸 Screenshots

### Dashboard Views
![Dashboard Progress Page](./ScreenShots/Dashboard-ProgressPage.png)
![Dashboard Progress Page](./ScreenShots/Dashboard-ProgressPage-2.png)
![Dashboard Stats Page](./ScreenShots/Dashboard-StatisiticsPage.png)


### Extension Mode
![Main Page](./screenshots/MainPage.png)
![Problem Generator Page](./screenshots/ProblemGenerator.png)
![Problem Statistics Page](./screenshots/ProlemStatistics%20.png)
![Problem Settings Page](./screenshots/ProblemSettings.png)

---
## Refactoring Strategy

Refactored session logic into smaller composable functions:
- `buildAdaptiveSessionSettings()`
- `fetchAndAssembleSessionProblems()`
...

This improves testability and isolates session generation logic from state logic.

---

## 🔧 Installation

```bash
git clone https://github.com/your-username/codemaster.git
cd codemaster
npm install
npm run dev



