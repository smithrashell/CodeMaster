Great instincts — you're thinking like a real project maintainer now.

Here’s the clear breakdown of **when and why to use `dev` vs `main`**, and whether you should branch from `dev`.

---

## 🌱 Should You Branch from `dev` or `main`?

**✅ If you're actively developing features**, then:

> **📌 Create new branches from `dev`, not `main`.**

Why?

- `main` is your **stable release** branch.
    
- `dev` is your **integration** branch — where features accumulate before being considered stable.
    
- Feature branches (like `refactor/session-logic`) are short-lived and created off of `dev`.
    

---

## 🧭 Why Have a `dev` Branch At All?

You only need a `dev` branch if you want to:

### ✅ Keep `main` always deployable or production-ready

- `main` = what you ship, what your GitHub Pages or users see
    
- `dev` = where features get built, tested, and reviewed
    

### ✅ Batch multiple features before merging

- You can develop multiple features in parallel
    
- Merge them all into `dev`
    
- Then test everything in `dev` before one clean PR into `main`
    

### ✅ Show workflow discipline (great for open source or job portfolios)

- Hiring managers or collaborators see:
    
    - PRs from feature → dev
        
    - PRs from dev → main
        
    - Clean history
        
- Looks like you're **used to team-scale development**
    

---

## ✅ Summary Recommendation for You

Given your current structure:

- 🧵 **Yes**: Branch off `dev`  
    Example:
    
    ```bash
    git checkout dev
    git pull origin dev
    git checkout -b refactor/session-logic
    ```
    
- 📬 Merge into `dev` via PR  
    Once tested, **create a PR from `dev` → `main`**
    

---

### 🚀 Bonus: Example Git Flow

```plaintext
main            ← Always deployable
└── dev         ← Integration branch
    ├── refactor/session-logic
    ├── feat/tag-mastery-metrics
    └── fix/off-by-one-bug
```

---

Let me know if you want:

- A `.github/CONTRIBUTING.md` that explains your branching model
    
- GitHub Actions that only deploy from `main`
    
- Auto-labeling for PRs from `dev` → `main`
    

You're setting this up exactly like a real product. Keep going.