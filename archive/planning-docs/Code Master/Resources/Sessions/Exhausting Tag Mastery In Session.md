🔥 **Excellent observation!**  
You’ve zeroed in on the exact tension point: **Over-filtering by tags could lead to 0 problems selected, even when some are due according to FSRS.**  
This is where introducing a **“Minimum FSRS quota”** can elegantly balance:

- **Tag Mastery (primary focus)**
- **Spaced Repetition (fallback safety net)**

---

## 🟢 **Core Idea for "Minimum FSRS Quota"**

> **Always include a fixed % or number of due FSRS problems, regardless of their tag match score.**

This prevents total overfitting to tags and avoids empty review sessions.

---

## 🟡 **Implementation Overview**

### **1. Two Buckets of Problems:**

|Bucket|Description|
|---|---|
|**Tag-focused Problems**|Current filtered logic based on unmastered tags (where `tagMatchScore >= threshold`).|
|**FSRS fallback Problems**|Problems **due for review (by ReviewSchedule)**, possibly outside tag focus, included as backup.|

---

## 🚀 **Implementation Steps:**

### **Step 1: Keep your current filtering for tag mastery:**

```js
// Tag mastery filtering (you already have)
reviewProblems = reviewProblems.filter((problem) =>
  (problem.Tags || []).every((tag) => tagsinTier.includes(tag))
);

reviewProblems.forEach((problem) => {
  problem.tagMatchScore = (problem.Tags || []).reduce((score, tag) => {
    return score + (unmasteredTags.includes(tag) ? 1 : 0);
  }, 0);
});

// High priority tag-matched problems
let tagFocusedProblems = reviewProblems.filter((p) => p.tagMatchScore >= 2);
```

---

### **Step 2: Collect fallback FSRS problems:**

1. Go back to **all problems**, but only filter by due date and exclude recently attempted ones (what you already do):

```js
let fsrsDueProblems = allProblems.filter(
  (problem) =>
    isDueForReview(problem.ReviewSchedule) ||
    !isRecentlyAttempted(problem.lastAttemptDate, problem.BoxLevel)
);
```

2. **Optionally remove duplicates:** Filter out problems already selected in `tagFocusedProblems`.

```js
const tagFocusedProblemIds = new Set(tagFocusedProblems.map((p) => p.id));
fsrsDueProblems = fsrsDueProblems.filter(
  (p) => !tagFocusedProblemIds.has(p.id)
);
```

---

### **Step 3: Decide on Minimum FSRS Quota:**

- Example: **20% of sessionLength OR minimum 2 problems.**

```js
const minFsrsQuota = Math.max(
  Math.floor(sessionLength * 0.2),
  2
);
const fsrsProblemsSelected = fsrsDueProblems
  .sort(
    (a, b) =>
      new Date(a.ReviewSchedule) - new Date(b.ReviewSchedule) // Earliest due first
  )
  .slice(0, minFsrsQuota);
```

---

### **Step 4: Combine both buckets:**

```js
let combinedProblems = [
  ...tagFocusedProblems,
  ...fsrsProblemsSelected
];

// Ensure final session length
combinedProblems = combinedProblems.slice(0, sessionLength);
```

---

## ✅ **What This Fixes:**

1. You will **never have empty sessions** due to tag filtering being too strict.
2. It **preserves tag mastery focus**, but guarantees you're still seeing FSRS due problems.
3. Allows your app to **balance long-term retention (FSRS) + immediate focus (tags)** without user micromanagement.

---

## 🟢 **Optional Improvement (Advanced):**

Make the **minimum FSRS quota dynamic**:

- If you detect that the user has:
    - **Few unmastered tags left → Increase FSRS quota.**
    - **Lots of unmastered tags → Decrease FSRS quota, favor tag learning.**

You could track this using `unmasteredTags.length`.

---

## **Would you like me to write a fully integrated version of your `getDailyReviewSchedule` function with these changes added?**