Exactly — and that presents a few **design pressures** during initial ladder generation:

---

### ⚠️ Issue: **All tags are unmastered initially**

This means:

- Every tag will try to create a ladder.
    
- Every problem will appear eligible for many ladders.
    
- Without checks, **problem overlap** across ladders becomes highly likely.
    

---

### ✅ **Solution Strategy**

To avoid redundancy and maintain pattern diversity, you should:

#### 1. **Limit the number of ladders generated at startup**

Instead of generating ladders for _every unmastered tag_:

> 📌 **Pick a limited number (e.g., 5-7) unmastered tags** to build initial ladders from.

You can base this on:

- Most popular tags
    
- Tags with the most available high-quality problems
    
- Tags in the “Core Concepts” tier
    

Once the user works through those ladders, others are lazily generated or fetched when needed.

#### 2. **Ensure problem uniqueness across ladders**

During ladder generation:

> ⛔ **Do not allow the same problem to appear in multiple ladders for unmastered tags**.

Track used problems globally per ladder generation. If a candidate problem is already in another active ladder, skip it _unless the ladder can’t be filled otherwise_.

```js
const usedProblemIds = new Set();

function generateLadder(tag, candidateProblems) {
  const ladder = [];

  for (const problem of candidateProblems) {
    if (!usedProblemIds.has(problem.id)) {
      ladder.push(problem);
      usedProblemIds.add(problem.id);
    }

    if (ladder.length === LADDER_SIZE) break;
  }

  return ladder;
}
```

You can allow overlap later for mastered or inactive tags.

#### 3. **Store the ladder source tag inside each problem reference**

This makes debugging and future de-duping easier:

```js
ladder.push({
  ...problem,
  sourceTag: tag,
});
```

---

### 🧠 So the startup process should look like:

1. Get all tags = unmastered.
    
2. Choose top 5–7 based on curriculum design.
    
3. Generate ladders for those tags.
    
    - Exclude problems already used in other ladders.
        
    - Prioritize problem-tag alignment and relationship strength.
        
4. Store ladders keyed by tag.
    
5. Delay generating other ladders until they’re needed (e.g. user masters first few).
    

---

### Optional: Prioritize foundational tags

You could assign every tag a classification tier (`Core`, `Fundamental`, `Advanced`), and prioritize `Core` tags during onboarding.

---

Let me know if you want a code example of this "initial ladder seeding" with uniqueness check and tier filtering.