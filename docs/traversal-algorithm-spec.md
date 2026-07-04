# Traversal Algorithm — Design Spec

**Status:** Design complete, not yet implemented.
**Depends on:** `data/tag_taxonomy.json` (40 nodes), `data/pattern_stats.json` (164 cells + adjacency), `data/classified_problems.json` (2,986 problems).
**Follows:** `session-2026-07-02-ds-technique-matrix-insights.md` and the 2026-07-03 classification pipeline session.

This spec defines how a learner moves through the DS×Technique cell graph and how mastery is judged. It intentionally does not touch app code — wiring this onto IndexedDB (`tag_relationships`, `tag_mastery`, `excluded_problems`) is a separate, later phase.

---

## 1. State tracked per learner

**Per DS node** (14 total — `array`, `hash table`, `matrix`, `string`, `graph`, `binary tree`, `trie`, `heap (priority queue)`, `linked list`, `binary search tree`, `tree`, `queue`, `stack`, `doubly-linked list`):
- `total_attempts`, `successful_attempts`
- `recent_results` — ring buffer, size `MASTERY_WINDOW_SIZE = 20` (existing constant, `Utils.js:247`)
- `attempted_problem_ids`
- `techniques_touched` — set of distinct technique nodes attempted under this DS
- `mastered`, `mastery_date`

**Per technique node** (26 total): same shape, with `ds_touched` (set of distinct DS nodes attempted with this technique) instead of `techniques_touched`.

**Per cell** (164 total, `DS::technique`): `attempted_problem_ids` only — a cell has no independent mastery bar. Every attempt in cell `X::Y` increments both the `X` DS-node record and the `Y` technique-node record simultaneously.

**Concurrency state**: which cell(s) are currently "active" (1 or 2 — see §4).

---

## 2. Mastery gates

Reuses `calculateMasteryThreshold` / `calculateMinimumAttempts` (`tag_relationships.js:317-371`) **unchanged** — no new formula was invented. They're fed:
- `problemCounts` aggregated per DS/technique from `pattern_stats.json` (summed across that node's cells), instead of per flat LC tag.
- `classification` from `tag_taxonomy.json`'s existing per-node `classification` field (already populated — `Core Concept` / `Fundamental Technique` / `Advanced Technique`), instead of the hardcoded placeholder `storeTagGraph` currently passes in before `classifyTags()` patches it.

| Gate | DS node | Technique node |
|---|---|---|
| Volume | `total_attempts ≥ minAttempts` | `total_attempts ≥ minAttempts` |
| Unique | `unique_problems ≥ ceil(minAttempts × 0.7)` | same |
| Accuracy | windowed ratio (last ≤20) `≥ masteryThreshold` | same |
| **Breadth (new)** | `techniques_touched.size ≥ max(2, ceil(0.25 × techniqueCountForThisDS))` | `ds_touched.size ≥ min(2, availableDsCount)` |

The breadth gate is new — `calculateMinimumAttempts` only covers volume and difficulty-tier coverage, nothing about which techniques/DS the attempts were spread across. It has to live alongside these functions' output (in the equivalent of `updateMasteryStatus`/`getMasteryRequirements`), not inside them.

The DS breadth gate started as `ceil(sqrt(n))`, but that scales *sublinearly* — it gave `array` (24 techniques) the weakest percentage requirement of any DS node (20.8%), the opposite of what you'd want for the single largest, most-encountered DS in the dataset. Switched to a flat 25% coverage floor instead, so the four biggest hub DS nodes (`array`/`hash table`/`matrix`/`string`) all land in the same ~25–29% band rather than the biggest one requiring the least. The technique breadth gate (`min(2, availableDsCount)`) was deliberately *not* given the same treatment — it's answering a different question (has this technique been shown to generalize beyond one DS context?) where 2 contexts is sufficient evidence of transfer regardless of how many total DS contexts a technique could theoretically appear in; requiring more just because more happen to exist doesn't test anything additional.

Demotion hysteresis matches the existing `tag_mastery.js` pattern: once mastered, an accuracy dip only un-masters if it falls more than 10 points below threshold. Volume/unique/breadth gates never regress once earned.

### Computed values (from current data)

Materialized in `data/node_mastery.json` (14 DS nodes + 26 technique nodes, includes `breadthGate` per node) — treat that file as the source of truth going forward; the tables below are a readable snapshot of the volume/unique/threshold columns only.

**DS nodes** (attempts / unique / threshold):

| DS | attempts | unique | threshold |
|---|---|---|---|
| array | 19 | 14 | 0.75 |
| string | 13 | 10 | 0.75 |
| matrix | 11 | 8 | 0.75 |
| hash table | 11 | 8 | 0.75 |
| binary tree | 10 | 7 | 0.80 |
| graph | 10 | 7 | 0.80 |
| heap (priority queue) | 9 | 7 | 0.80 |
| tree | 9 | 7 | 0.75 |
| linked list | 9 | 7 | 0.80 |
| binary search tree | 8 | 6 | 0.85 |
| stack | 8 | 6 | 0.80 |
| trie | 8 | 6 | 0.85 |
| queue | 8 | 6 | 0.85 |
| doubly-linked list | 7 | 5 | 0.85 |

**Technique nodes** (attempts / unique / threshold):

| Technique | attempts | unique | threshold |
|---|---|---|---|
| dynamic programming | 13 | 10 | 0.75 |
| greedy | 12 | 9 | 0.75 |
| simulation | 12 | 9 | 0.80 |
| counting | 11 | 8 | 0.80 |
| depth-first search | 11 | 8 | 0.75 |
| binary search | 11 | 8 | 0.75 |
| two pointers | 11 | 8 | 0.75 |
| math | 10 | 7 | 0.75 |
| sliding window | 10 | 7 | 0.80 |
| bit manipulation | 10 | 7 | 0.75 |
| prefix sum | 10 | 7 | 0.80 |
| breadth-first search | 10 | 7 | 0.75 |
| sorting | 10 | 7 | 0.75 |
| backtracking | 9 | 7 | 0.80 |
| monotonic stack | 9 | 7 | 0.80 |
| union find | 7 | 5 | 0.80 |
| enumeration | 8 | 6 | 0.80 |
| recursion | 8 | 6 | 0.85 |
| geometry | 8 | 6 | 0.85 |
| divide and conquer | 8 | 6 | 0.85 |
| shortest path | 6 | 5 | 0.85 |
| bitmask | 6 | 5 | 0.80 |
| topological sort | 6 | 5 | 0.80 |
| intervals | 8 | 6 | 0.85 |
| memoization | 6 | 5 | 0.85 |
| monotonic queue | 6 | 5 | 0.80 |

### `monotonic queue` — breadth gate exception, data-derived not hardcoded

All 17 problems carrying the `Monotonic Queue` LC tag classify to `primary_ds: array` — verified against `classified_problems.json`, not a misclassification (the taxonomy node's own `REQUIRES → array` / `REQUIRES → heap (priority queue)` edges reflect the same reality: it's an array/sliding-window technique implemented with a deque, never primary on another DS). So `availableDsCount = 1` for this technique, and the breadth-gate formula `min(2, availableDsCount)` naturally relaxes to `≥1` — i.e., falls back to a plain volume+accuracy gate. This is computed generically per technique, not special-cased: if the taxonomy ever gains a second DS pairing for `monotonic queue`, the gate self-tightens back to 2 without code changes.

---

## 3. Cell selection (what's served next)

1. From the active cell's `adjacentCells` (in `pattern_stats.json`), consider friction-2 neighbors — single-axis moves only (share DS or share technique). Friction-4/diagonal moves (both axes change simultaneously) are never required; the cell-adjacency graph over all 164 populated cells is a single connected component, and every cell is reachable from a natural starting cell within 2 hops (validated separately).
2. Rank candidates:
   1. Friction ascending (cheap moves first).
   2. Within the same friction tier, `totalProblems` descending — biggest pool wins ties. This encodes "master the largest groups first" and is why early movement naturally stays inside `array`/`hash table`/`string`/`matrix`.
   3. Within remaining ties, deprioritize cells whose DS *and* technique are both already mastered (no new signal left to gain there).
3. "Stay in the active cell" is always a friction-0 option whenever unattempted problems remain in it, and takes priority over moving on when recent performance is weak (§4) — performance overrides movement rather than the algorithm blindly hopping to the next cheapest cell regardless of how the learner is doing.
4. **Start state**: begin at `array::counting` — the highest-adjacency, highest-population natural entry point (min degree 7 among all cells, every other cell reachable within 2 hops).

### Why no artificial DS-diversity cap is needed

Technique mastery already requires `ds_touched.size ≥ min(2, availableDsCount)`. Once a DS's adjacent *unmastered* cells at the cheapest friction tier are exhausted or already mastered, the only friction-2 moves remaining are inherently cross-DS (new technique on a new DS, or same technique on a new DS) — so diversification happens organically once a hub DS like `array` is actually depleted, not by an arbitrary "switch after N techniques" rule layered on top.

---

## 4. Performance-gated concurrency

- Default: **1 active cell** (full focus).
- Promote to **2 concurrent active cells** only when the active cell's windowed accuracy is `≥ 70%` over `≥ 3` attempts — reuses the same windowed-accuracy signal computed for mastery gating, not a new metric.
- Demote back to 1 the moment any active cell's windowed accuracy drops below `50%` — drop the newer/weaker thread, keep grinding the original.
- Hard cap of 2 concurrent cells for now (a future loosening to 3 for learners already near-mastering multiple techniques is plausible but not needed to start).

This replaces a fixed "always exhaust" or "always interleave" policy with one that widens only when the learner has demonstrated headroom, and narrows immediately if attention is visibly split too thin.

---

## 5. Difficulty stepping within a cell

Use the cell's `problemCounts.{easy, medium, hard}`: start easy, step up to medium/hard only once windowed accuracy at the current difficulty clears the threshold. Same mechanism `getLadderCoverage` already uses for tag-scoped pattern ladders, just re-scoped to be cell-scoped.

---

## 6. Excluded / fallback problems

The 38 `cell_status: "fallback"` rows in `classified_problems.json` (problems that didn't resolve to a clean cell during classification) are never served by the traversal algorithm. They route to the same exclusion concept the app already has at runtime (`excludeProblem(leetcode_id, reason)` / `excluded_problems` IndexedDB store, `chrome-extension-app/src/shared/db/stores/excludedProblems.js`), with `reason: "unclassified"` — not silently dropped from the problem pool.

---

## What's deliberately deferred to the wiring phase

- ~~Generating `data/node_mastery.json`~~ — done (14 DS nodes + 26 technique nodes, computed thresholds + breadth gates).
- Plumbing DS/technique node aggregates through `calculateMasteryThreshold`/`calculateMinimumAttempts`'s call site instead of the flat-tag path.
- A DS/technique-node equivalent of the `tag_relationships` IndexedDB store (nothing like it exists yet).
- Rewriting `updateTagMasteryForAttempt` (`tag_mastery.js`) to credit a problem's `primary_ds`/`primary_technique` cell instead of every LC tag equally.
- An `excluded_problems` seed file for the 38 fallback problems, formatted to match `excludeProblem`'s `{leetcode_id, excluded_at, reason}` shape.
- Reconciling `LeetCode_Tags_Combined.json` (what the app currently bundles) against the classification pipeline's output.
- IndexedDB schema version bump + migration for existing local user data.
