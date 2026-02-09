# VF2 Subgraph Isomorphism — Complexity Analysis

## Overview

The proof assistant uses VF2-style backtracking for pattern DAG matching with variable operand binding and edge labels. This document analyzes time and space complexity.

**Notation:**
- \( n \) = pattern nodes
- \( m \) = target nodes  
- \( E_p \) = pattern edges
- \( E_t \) = target edges
- \( E = E_p + E_t \)
- \( \Delta \) = max degree (in + out) of any node

---

## 1. Algorithm Structure

```
vf2ExprSubgraphIsomorphism / vf2ExprSubgraphIsomorphismAll
├── buildAdjacency(pattern) + buildAdjacency(target)
├── search()  [backtracking]
│   ├── Pick first unmapped pattern node p
│   ├── For each unused target node t:
│   │   └── feasible(p, t)
│   │       ├── exprDataMatches(pData, tData)
│   │       └── For each mapped neighbor: edge existence + getEdgeType()
│   └── Recursive search
└── Return mapping
```

---

## 2. Per-Component Complexity

### 2.1 `buildAdjacency(structure)`

- **Time:** \( O(V + E) \) per structure → \( O(n + m + E) \) total
- **Space:** \( O(n + m + E) \) for adjacency lists

### 2.2 `getEdgeType(edges, from, to)`

- **Current impl:** Linear scan over `edges` array
- **Time:** \( O(|edges|) \) per call
- **In feasible():** Called up to \( \deg_{\text{out}}(p) + \deg_{\text{in}}(p) \) times
- **Per feasible call:** \( O(\Delta \cdot (E_p + E_t)) = O(\Delta \cdot E) \)

### 2.3 `exprDataMatches(pData, tData)`

- Operand count is bounded (typically ≤ 4 for proof rules)
- **Time:** \( O(1) \) in practice

### 2.4 `feasible(p, t)`

- exprDataMatches: \( O(1) \)
- Outgoing neighbors: \( O(\deg_{\text{out}}(p) \cdot E) \) (edge existence is \( O(1) \) with adjacency; `getEdgeType` dominates)
- Incoming neighbors: \( O(\deg_{\text{in}}(p) \cdot E) \)
- **Time per call:** \( O(\Delta \cdot E) \)

### 2.5 `search()` — Backtracking

- **Worst case:** Subgraph isomorphism is NP-complete; VF2 can explore up to \( O(n! \cdot \binom{m}{n}) \) candidate matchings
- **Per recursive level:** Up to \( m \) target candidates; each invokes `feasible`
- **Single-call (find first match):** Early exit on success; worst case still exponential
- **All-call (find all matches):** Capped by `VF2_MAX_STEPS` (10M) to prevent freeze

---

## 3. Aggregate Bounds

### Time

| Phase | Complexity |
|-------|------------|
| Setup (adjacency) | \( O(n + m + E) \) |
| Per `feasible` | \( O(\Delta \cdot E) \) |
| Total search (worst) | \( O\bigl(n! \cdot m \cdot \Delta \cdot E\bigr) \) |

In practice, feasibility pruning reduces explored branches. Typical proof-rule DAGs are small (\( n \approx 10 \), \( m \approx 20 \)), so performance is acceptable.

### Space

- Adjacency: \( O(n + m + E) \)
- Mapping / reverseMapping: \( O(n) \)
- varToTarget, targetToVar: \( O(\text{#variables}) \), typically \( O(n) \)
- Recursion stack: \( O(n) \) depth
- **Total:** \( O(n + m + E) \)

---

## 4. Optimization Opportunities

### 4.1 Edge-type lookup

**Current:** `getEdgeType` does `edges.find(...)` → \( O(E) \) per lookup.

**Improvement:** Build a `Map<(from,to), edgeType>` once during setup:

```ts
// O(E) one-time build
const edgeTypeMap = new Map<string, number>();
for (const e of edges) {
  edgeTypeMap.set(`${e.from}\0${e.to}`, e.edgeType ?? 0);
}
// O(1) lookup
getEdgeType(edgeTypeMap, from, to)
```

This reduces `feasible` from \( O(\Delta \cdot E) \) to \( O(\Delta) \) per call.

### 4.2 Candidate ordering (VF2-Cordella)

Classic VF2 uses candidate set ordering to prune earlier. The current implementation always picks the first unmapped pattern node (`pNodes.find`) and iterates all unused targets. A more sophisticated ordering (e.g., connectivity-based) can reduce branching.

### 4.3 Early degree pruning

`vf2.ts` already checks degree consistency. Extending this to edge-type degree (count of edges per type) could prune before entering `feasible`.

---

## 5. Impact of Edge Labels

Before edge labels (types 0–4), structurally symmetric branches produced multiple equivalent mappings (e.g., 8 for a 2×2 grid). VF2 explored all of them.

**After edge labels:**  
Feasibility fails when `pType !== tType`, so symmetric swaps (top↔bottom) are rejected early. This:

- Cuts the number of matches (correct behavior)
- Often reduces backtracking, since branches fail sooner
- Worst-case complexity is unchanged (still NP)

---

## 6. Practical Notes

- **Step cap:** `vf2ExprSubgraphIsomorphismAll` aborts after 10M steps
- **Typical inputs:** Rules ~10 nodes; targets ~10–30 nodes; low degree
- **Bottleneck:** `getEdgeType` linear scan in hot path; edge-type map would help most
