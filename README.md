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

### Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Google Chrome** browser with Developer Mode enabled
- **Git** for version control

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/codemaster.git
   cd codemaster
   ```

2. **Install dependencies**
   ```bash
   cd chrome-extension-app
   npm install
   ```

3. **Build the extension**
   ```bash
   # Development build with watch mode
   npm run dev
   
   # Or production build
   npm run build
   ```

4. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `chrome-extension-app/dist` folder
   - The CodeMaster extension should now appear in your extensions

5. **Start developing**
   - Visit [LeetCode](https://leetcode.com/problemset/algorithms/) to see the extension in action
   - Use the extension popup or standalone dashboard for full functionality

### Development Commands

```bash
# Chrome extension development (run from chrome-extension-app/ directory)
npm run dev          # Development build with watch mode
npm run build        # Production build
npm run lint         # Code linting
npm run lint:fix     # Auto-fix linting issues
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode
npm run format       # Format code with Prettier
```

### Project Structure

```
CodeMaster/
├── chrome-extension-app/    # Chrome extension source code
│   ├── src/
│   │   ├── app/             # Standalone dashboard application
│   │   ├── content/         # LeetCode page integration
│   │   ├── popup/           # Extension popup interface
│   │   └── shared/          # Shared utilities, services, components
│   ├── public/              # Extension manifest and assets
│   └── dist/                # Built extension files (load this in Chrome)
├── docs/                    # Comprehensive documentation hub
│   ├── getting-started/     # Installation and quick start guides
│   ├── architecture/        # System design and technical architecture
│   ├── development/         # Contributing, coding standards, testing
│   ├── features/           # Learning algorithms and system features
│   ├── api/                # Service and database API references
│   └── troubleshooting/    # Common issues and solutions
└── README.md               # Project overview and quick navigation
```

### Next Steps

- 📖 **[Complete Documentation Hub](docs/README.md)** - Comprehensive technical documentation and guides
- 🚀 **[Quick Start Installation](docs/getting-started/installation.md)** - Get running in 15 minutes
- 🏗️ **[Architecture Overview](docs/architecture/overview.md)** - Understand the system design
- 🤝 **[Contributing Guide](docs/development/contributing.md)** - Developer workflow and standards
- 🛠️ **[API References](docs/api/)** - Services and database API documentation
- 🎯 **[Learning Features](docs/features/)** - Leitner system, adaptive sessions, pattern ladders
- 🐛 **[Troubleshooting](docs/troubleshooting/)** - Common issues and solutions


