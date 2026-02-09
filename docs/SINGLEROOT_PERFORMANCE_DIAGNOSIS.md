# SingleRootDAGInjection Performance Diagnosis

## Summary

Proof step verification remains slow when **both target and pattern contain branches** because:

1. **Rule enumeration**: We try up to ~2300 rules per transition until one matches.
2. **Equivalent Substitution dominates**: Each rule runs Commutativity + Transitivity (fast) + Equivalent Substitution (4 × trySubstitution).
3. **SingleRootDAGInjection**: Tries every target node as root — O(T) iterations.
4. **convertRuleOtherSideWithDAG**: Called per match attempt; includes substituteInDAG, dagToExpr, resolveOperandMapping.

**Measured**: 50 rules with branch expressions ≈ 31ms. Extrapolated to full rule set: **~1.4s per transition** when no match (worst case).

---

## Time Complexity

### SingleRootDAGInjection

| Symbol | Meaning |
|--------|---------|
| T | Number of target nodes |
| P | Number of pattern nodes |
| d | Max node degree (outgoing edges, typically ≤ 2 for Bb) |

**Structure**:
1. **Outer loop**: Tries each of T target nodes as root → **O(T) iterations**.
2. **Per iteration**: `fillMap(pStart, tStart)` recursively matches pattern to target.
3. **fillMap**: Deterministic — for each pattern node, `findOutgoingWithType` returns exactly one target node (by edge type). No backtracking over alternatives.
4. **fillMap depth**: O(P) recursive levels.
5. **Per level**: `getOutgoingWithTypes` O(d), `findOutgoingWithType` O(d), `exprDataMatches` O(1).

**SingleRootDAGInjection per run**: **O(T × P × d)**

### trySubstitution

- 4 directions (left/right, rule normal/reversed).
- Each direction: iterates SingleRootDAGInjection until match **or** maxTrials (32–64).
- Per match: `convertRuleOtherSideWithDAG` (substituteInDAG, dagToExpr, resolveOperandMapping).

**Per direction**: O(min(M, maxTrials) × (T×P×d + convertRuleOtherSideWithDAG)), where M = matches from SingleRootDAGInjection (up to T).

### Full Verification (one transition)

- Up to R rules (≈2300).
- Per rule: Commutativity O(1), Transitivity O(1), Equivalent Substitution ≈ 4 × trySubstitution.
- **Worst case**: O(R × 4 × (T×P×d + substitution cost)) when no rule matches.

---

## Why It's Slow With Branches

1. **T can be large**: Nested branches yield 20–50+ nodes. SingleRootDAGInjection tries every node as root.
2. **No early pruning**: Wrong root fails only after full fillMap traversal (up to P levels).
3. **Many rules**: We enumerate rules sequentially. When the matching rule is late (or absent), we pay for all prior rules.
4. **convertRuleOtherSideWithDAG**: substituteInDAG, extractSubgraphFromNode, dagToExpr are non-trivial.

---

## Possible Optimizations

1. **Root pruning**: Only try target nodes that are valid roots (e.g. no incoming edges, or tail in Brb mode). Reduces T in the outer loop.
2. **Rule filtering**: Pre-filter rules by structure (e.g. skip rules without branches when target has no branches).
3. **Early exit in fillMap**: Fail fast when exprDataMatches fails, before recursing.
4. **Caching**: Cache DAG builds (exprToDAG) for repeated rule/target pairs.
5. **Parallel rule checks**: Run rule checks in parallel (e.g. in worker with multiple rules per batch).

---

## Run the Diagnosis

```bash
npx tsx scripts/diagnose-singleroot-performance.ts
```
